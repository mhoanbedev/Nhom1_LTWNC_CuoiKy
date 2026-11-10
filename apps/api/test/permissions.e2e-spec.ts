import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  Role,
  type AuthResponse,
  type CandidateApplication,
  type CvFile,
  type NotificationItem,
  type Paginated,
  type RecruiterJob,
  type UserRole,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { adminSession, type AdminSession } from './utils/admin-session';
import { collectRoutes, type RouteInfo } from './utils/routes';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');
const UUID = '00000000-0000-4000-8000-000000000000';

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
  privateDownloadUrl: (publicId: string) => ({
    url: `https://cloudinary.test/${publicId}`,
    expiresAt: new Date(Date.now() + 60_000),
  }),
};

/** Route công khai (không cần đăng nhập), theo bảng route của đặc tả (mục 7). */
const PUBLIC_ROUTES = new Set([
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/register/candidate',
  'POST /auth/register/recruiter',
  'POST /auth/oauth/google',
  'GET /jobs',
  'GET /jobs/:slug',
  'GET /companies',
  'GET /companies/:slug',
  'GET /companies/:slug/jobs',
  'GET /meta/skills',
  'GET /meta/industries',
  'GET /meta/locations',
  'GET /seo/sitemap',
  'GET /seo/static-params',
  'GET /health',
]);

/**
 * Quy ước phân quyền theo đường dẫn (mục 2 của đặc tả). `'PUBLIC'`: không cần đăng nhập; `[]`: mọi
 * vai trò đã đăng nhập; còn lại là danh sách vai trò được phép.
 */
function expectedAccess(route: RouteInfo): 'PUBLIC' | UserRole[] {
  const key = `${route.method} ${route.path}`;
  if (PUBLIC_ROUTES.has(key)) return 'PUBLIC';
  if (route.path.startsWith('/admin/')) return [Role.ADMIN];
  if (route.path.startsWith('/recruiter/')) return [Role.RECRUITER];
  if (route.path.startsWith('/me/notifications')) return [];
  if (route.path.startsWith('/auth/')) return [];
  // Tải CV: ứng viên (CV của mình) hoặc nhà tuyển dụng (CV nộp vào tin công ty mình); service lọc.
  if (route.path.startsWith('/files/')) return [];
  if (route.path.startsWith('/me/') || key === 'POST /jobs/:jobId/applications') {
    return [Role.CANDIDATE];
  }
  throw new Error(`Route chưa có quy ước phân quyền: ${key}. Thêm vào expectedAccess.`);
}

describe('Phân quyền (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  let routes: RouteInfo[];
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  const sessions = {} as Record<
    'candidate' | 'otherCandidate' | 'recruiter' | 'otherRecruiter',
    AuthResponse
  >;
  let job: RecruiterJob;
  let draft: RecruiterJob;
  let application: CandidateApplication;
  let cv: CvFile;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CloudinaryService)
      .useValue(fakeCloudinary)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    admin = await adminSession(app, dataSource);
    await seedCatalogs(dataSource.manager);
    const skills = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    skillId = skills[0]?.id ?? '';
    routes = collectRoutes(app);

    sessions.recruiter = await newRecruiter('A');
    sessions.otherRecruiter = await newRecruiter('B');
    sessions.candidate = await newCandidate();
    sessions.otherCandidate = await newCandidate();

    job = await createJob(sessions.recruiter, 'Đăng', true);
    draft = await createJob(sessions.recruiter, 'Nháp', false);
    const cvRes = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(sessions.candidate))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    cv = (cvRes.body as { data: CvFile }).data;
    const applied = await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(sessions.candidate))
      .send({ cvFileId: cv.id })
      .expect(201);
    application = (applied.body as { data: CandidateApplication }).data;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-perm-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-perm-${runId}-${(counter += 1)}@test.local`;

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: `HR ${label}`,
        company: { translations: { vi: { name: `Công ty Quyền ${label} ${runId}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    await http()
      .patch(`/api/v1/admin/companies/${session.user.companyId}/approve`)
      .set(asAdmin())
      .expect(200);
    return session;
  }

  async function newCandidate(): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng viên quyền' })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    return session;
  }

  async function createJob(
    session: AuthResponse,
    label: string,
    publish: boolean,
  ): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(session))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập quyền ${label} ${runId}` } },
      })
      .expect(201);
    const created = (res.body as { data: RecruiterJob }).data;
    if (publish) {
      await http()
        .post(`/api/v1/recruiter/jobs/${created.id}/publish`)
        .set(bearer(session))
        .expect(200);
    }
    return created;
  }

  /** Gọi route với tham số giả (UUID); body rỗng vì Guard chặn trước khi validate. */
  function call(route: RouteInfo, headers: Record<string, string> = {}) {
    const path = `/api/v1${route.path.replace(/:[A-Za-z]+/g, UUID)}`;
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    return http()[method](path).set(headers).send({});
  }

  describe('quy ước trên mọi route', () => {
    it('mỗi route khớp quy ước của đặc tả (thêm route mới mà quên @Roles/@Public thì fail)', () => {
      expect(routes.length).toBeGreaterThan(60);
      const mismatches = routes.flatMap((route) => {
        const expected = expectedAccess(route);
        const actual = route.isPublic ? 'PUBLIC' : [...route.roles].sort();
        const want = expected === 'PUBLIC' ? 'PUBLIC' : [...expected].sort();
        return JSON.stringify(actual) === JSON.stringify(want)
          ? []
          : [
              `${route.method} ${route.path}: có ${JSON.stringify(actual)}, cần ${JSON.stringify(want)}`,
            ];
      });
      expect(mismatches).toEqual([]);
    });

    it('route bảo vệ: không có token → 401', async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic)) {
        const res = await call(route);
        if (res.status !== 401) failures.push(`${route.method} ${route.path}: ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it('route theo vai trò: sai vai trò → 403 (Guard chặn trước validate)', async () => {
      const tokens: Record<UserRole, Record<string, string>> = {
        [Role.CANDIDATE]: bearer(sessions.candidate),
        [Role.RECRUITER]: bearer(sessions.recruiter),
        [Role.ADMIN]: asAdmin(),
      };
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic && r.roles.length > 0)) {
        for (const [role, headers] of Object.entries(tokens) as [
          UserRole,
          Record<string, string>,
        ][]) {
          if (route.roles.includes(role)) continue;
          const res = await call(route, headers);
          if (res.status !== 403)
            failures.push(`${role} ${route.method} ${route.path}: ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  describe('quyền sở hữu', () => {
    const status = async (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      session: AuthResponse | 'admin',
      body: object = {},
    ) =>
      (
        await http()
          [method](`/api/v1${path}`)
          .set(session === 'admin' ? asAdmin() : bearer(session))
          .send(body)
      ).status;

    it('nhà tuyển dụng khác công ty: đơn ứng tuyển (riêng tư) → 404', async () => {
      const other = sessions.otherRecruiter;
      expect(await status('get', `/recruiter/jobs/${job.id}/applications`, other)).toBe(404);
      expect(await status('get', `/recruiter/applications/${application.id}`, other)).toBe(404);
      expect(
        await status('patch', `/recruiter/applications/${application.id}/status`, other, {
          to: 'REVIEWING',
        }),
      ).toBe(404);
      expect(await status('get', `/recruiter/applications/${application.id}/notes`, other)).toBe(
        404,
      );
      expect(
        await status('post', `/recruiter/applications/${application.id}/notes`, other, {
          content: 'Ghi chú lén',
        }),
      ).toBe(404);
    });

    it('nhà tuyển dụng khác công ty: tin đang đăng (công khai) → 403, tin nháp (riêng tư) → 404', async () => {
      const other = sessions.otherRecruiter;
      expect(await status('get', `/recruiter/jobs/${job.id}`, other)).toBe(403);
      expect(await status('patch', `/recruiter/jobs/${job.id}`, other, { quantity: 9 })).toBe(403);
      expect(await status('post', `/recruiter/jobs/${job.id}/close`, other)).toBe(403);
      expect(await status('get', `/recruiter/jobs/${draft.id}`, other)).toBe(404);
      expect(await status('delete', `/recruiter/jobs/${draft.id}`, other)).toBe(404);
      expect(await status('post', `/recruiter/jobs/${draft.id}/publish`, other)).toBe(404);
    });

    it('ứng viên khác: đơn và CV của người khác → 404', async () => {
      const other = sessions.otherCandidate;
      expect(await status('get', `/me/applications/${application.id}`, other)).toBe(404);
      expect(await status('post', `/me/applications/${application.id}/withdraw`, other)).toBe(404);
      expect(await status('get', `/files/cvs/${cv.id}`, other)).toBe(404);
      expect(await status('delete', `/me/cvs/${cv.id}`, other)).toBe(404);
      expect(await status('patch', `/me/cvs/${cv.id}/default`, other)).toBe(404);
    });

    it('tải CV: chủ CV và nhà tuyển dụng nhận đơn được; công ty khác và admin thì 404', async () => {
      expect(await status('get', `/files/cvs/${cv.id}`, sessions.candidate)).toBe(200);
      expect(await status('get', `/files/cvs/${cv.id}`, sessions.recruiter)).toBe(200);
      expect(await status('get', `/files/cvs/${cv.id}`, sessions.otherRecruiter)).toBe(404);
      expect(await status('get', `/files/cvs/${cv.id}`, 'admin')).toBe(404);
    });

    it('thông báo của người khác → 404', async () => {
      const list = (
        await http().get('/api/v1/me/notifications').set(bearer(sessions.recruiter)).expect(200)
      ).body as Paginated<NotificationItem>;
      const mine = list.data[0];
      expect(mine).toBeDefined();
      expect(
        await status('patch', `/me/notifications/${mine?.id}/read`, sessions.otherRecruiter),
      ).toBe(404);
    });
  });
});
