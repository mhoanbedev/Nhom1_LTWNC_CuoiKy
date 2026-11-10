import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AuthResponse,
  CvFile,
  PublicJobDetail,
  RecommendedJob,
  RecruiterJob,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { adminSession, type AdminSession } from './utils/admin-session';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

/**
 * Kỹ năng riêng của lần chạy (không có trong danh mục seed), để tin gợi ý chỉ gồm tin của test
 * dù DB dev đã có sẵn tin khác.
 */
const SKILLS = ['a', 'b', 'c'] as const;
type SkillKey = (typeof SKILLS)[number];

describe('Gợi ý việc theo matchScore (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  const skillId = {} as Record<SkillKey, string>;
  let hr: AuthResponse;
  let candidate: AuthResponse;
  const jobs = {} as Record<
    'full' | 'twoThirds' | 'oneThird' | 'noOverlap' | 'hidden' | 'applied',
    RecruiterJob
  >;

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
    for (const key of SKILLS) {
      const rows = await dataSource.query<{ id: string }[]>(
        `INSERT INTO skills (slug, name_vi, name_en) VALUES ($1, $2, $3) RETURNING id`,
        [`e2e-rec-${runId}-${key}`, `Kỹ năng ${key.toUpperCase()}`, `Skill ${key.toUpperCase()}`],
      );
      skillId[key] = rows[0]?.id ?? '';
    }

    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: 'HR Gợi ý',
        company: { translations: { vi: { name: `Công ty Gợi Ý ${runId}` } } },
      })
      .expect(201);
    hr = (res.body as { data: AuthResponse }).data;
    await http()
      .patch(`/api/v1/admin/companies/${hr.user.companyId}/approve`)
      .set(asAdmin())
      .expect(200);

    // Ứng viên có A, B. Trọng số: bắt buộc 2, ưu tiên 1.
    jobs.full = await createJob('Đủ', { a: true, b: true }); // 4/4 = 100
    jobs.twoThirds = await createJob('Hai phần ba', { a: true, c: false }); // 2/3 = 67
    jobs.oneThird = await createJob('Một phần ba', { b: false, c: true }); // 1/3 = 33
    jobs.noOverlap = await createJob('Không trùng', { c: true });
    jobs.hidden = await createJob('Bị ẩn', { a: true, b: true });
    jobs.applied = await createJob('Đã nộp', { a: true, b: true });
    await http()
      .patch(`/api/v1/admin/jobs/${jobs.hidden.id}/hide`)
      .set(asAdmin())
      .send({ reason: 'Nội dung sai sự thật' })
      .expect(200);

    candidate = await newCandidate([skillId.a, skillId.b]);
    const cvRes = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(candidate))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    const cv = (cvRes.body as { data: CvFile }).data;
    const applied = await http()
      .post(`/api/v1/jobs/${jobs.applied.id}/applications`)
      .set(bearer(candidate))
      .send({ cvFileId: cv.id })
      .expect(201);
    const applicationId = (applied.body as { data: { id: string } }).data.id;
    // Đơn đã rút vẫn tính là đã nộp.
    await http()
      .post(`/api/v1/me/applications/${applicationId}/withdraw`)
      .set(bearer(candidate))
      .expect(200);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-rec-${runId}%'`);
    await dataSource.query(`DELETE FROM skills WHERE slug LIKE 'e2e-rec-${runId}-%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-rec-${runId}-${(counter += 1)}@test.local`;

  /** `skills`: kỹ năng → bắt buộc (true) hay ưu tiên (false). */
  async function createJob(
    label: string,
    skills: Partial<Record<SkillKey, boolean>>,
  ): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: Object.entries(skills).map(([key, isRequired]) => ({
          skillId: skillId[key as SkillKey],
          isRequired,
        })),
        translations: { vi: { title: `Thực tập gợi ý ${label} ${runId}` } },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    return job;
  }

  async function newCandidate(skills: string[]): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng viên gợi ý' })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    if (skills.length > 0) {
      const put = (step: string, body: object) =>
        http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
      await put('basic', { headline: 'Sinh viên CNTT' });
      await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
      await put('skills', { items: skills.map((id) => ({ skillId: id, level: 3 })) });
    }
    return session;
  }

  const recommended = async (session: AuthResponse, query = '') =>
    (
      (await http().get(`/api/v1/me/recommended-jobs${query}`).set(bearer(session)).expect(200))
        .body as { data: RecommendedJob[] }
    ).data;

  it('điểm cao trước; bỏ tin không trùng, bị ẩn, đã nộp (kể cả đã rút)', async () => {
    const result = await recommended(candidate);
    expect(result.map((job) => [job.id, job.matchScore])).toEqual([
      [jobs.full.id, 100],
      [jobs.twoThirds.id, 67],
      [jobs.oneThird.id, 33],
    ]);
  });

  it('kèm kỹ năng khớp, tên theo ?lang', async () => {
    const [, twoThirds] = await recommended(candidate, '?lang=en');
    expect(twoThirds?.matchedSkills).toEqual([
      { id: skillId.a, slug: `e2e-rec-${runId}-a`, name: 'Skill A', isRequired: true },
    ]);
    expect(twoThirds?.skills).toHaveLength(2);
  });

  it('hồ sơ chưa có kỹ năng thì mảng rỗng', async () => {
    const fresh = await newCandidate([]);
    expect(await recommended(fresh)).toEqual([]);
  });

  it('chi tiết tin: ứng viên thấy matchScore, khách thì không', async () => {
    const slug = jobs.twoThirds.translations.vi.slug;
    const asCandidate = await http().get(`/api/v1/jobs/${slug}`).set(bearer(candidate)).expect(200);
    expect((asCandidate.body as { data: PublicJobDetail }).data).toMatchObject({
      matchScore: 67,
      matchedSkillIds: [skillId.a],
    });

    const asGuest = await http().get(`/api/v1/jobs/${slug}`).expect(200);
    expect((asGuest.body as { data: PublicJobDetail }).data).not.toHaveProperty('matchScore');
  });

  it('không phải ứng viên thì 403', async () => {
    await http().get('/api/v1/me/recommended-jobs').set(bearer(hr)).expect(403);
    await http().get('/api/v1/me/recommended-jobs').expect(401);
  });

  it('tin không trùng kỹ năng nào vẫn có matchScore 0 ở trang chi tiết', async () => {
    const res = await http()
      .get(`/api/v1/jobs/${jobs.noOverlap.translations.vi.slug}`)
      .set(bearer(candidate))
      .expect(200);
    expect((res.body as { data: PublicJobDetail }).data).toMatchObject({
      matchScore: 0,
      matchedSkillIds: [],
    });
  });
});
