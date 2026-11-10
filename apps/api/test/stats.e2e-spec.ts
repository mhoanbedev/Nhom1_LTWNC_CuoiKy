import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AdminStats,
  AuthResponse,
  CandidateApplication,
  CvFile,
  RecruiterJob,
  RecruiterStats,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { vnDate } from '../src/modules/stats/daily-series';
import { adminSession, type AdminSession } from './utils/admin-session';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

const zero = { SUBMITTED: 0, REVIEWING: 0, INTERVIEW: 0, PASSED: 0, FAILED: 0, WITHDRAWN: 0 };

describe('Thống kê (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let hr: AuthResponse;
  let first: RecruiterJob;
  let second: RecruiterJob;
  let draft: RecruiterJob;

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

    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: 'HR Thống kê',
        company: {
          translations: {
            vi: { name: `Công ty Thống Kê ${runId}` },
            en: { name: `Stats Co ${runId}` },
          },
        },
      })
      .expect(201);
    hr = (res.body as { data: AuthResponse }).data;
    await http()
      .patch(`/api/v1/admin/companies/${hr.user.companyId}/approve`)
      .set(asAdmin())
      .expect(200);
    first = await createJob('Một', true);
    second = await createJob('Hai', true);
    draft = await createJob('Nháp', false);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-stats-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-stats-${runId}-${(counter += 1)}@test.local`;

  async function createJob(label: string, publish: boolean): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập thống kê ${label} ${runId}` } },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    if (publish) {
      await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    }
    return job;
  }

  /** Ứng viên mới, hồ sơ đủ, nộp vào `job`. */
  async function apply(job: RecruiterJob): Promise<{
    session: AuthResponse;
    application: CandidateApplication;
  }> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng viên thống kê' })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    const cvRes = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(session))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    const cv = (cvRes.body as { data: CvFile }).data;
    const applied = await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(session))
      .send({ cvFileId: cv.id })
      .expect(201);
    return { session, application: (applied.body as { data: CandidateApplication }).data };
  }

  const adminStats = async (query = '') =>
    (
      (await http().get(`/api/v1/admin/stats${query}`).set(asAdmin()).expect(200)).body as {
        data: AdminStats;
      }
    ).data;

  it('nhà tuyển dụng: số đơn từng trạng thái của mỗi tin, mới tạo trước, kèm tổng', async () => {
    const empty = await http().get('/api/v1/recruiter/stats').set(bearer(hr)).expect(200);
    expect((empty.body as { data: RecruiterStats }).data.totals).toEqual({
      total: 0,
      byStatus: zero,
    });

    const a = await apply(first);
    await apply(first);
    const c = await apply(first);
    await apply(second);
    await http()
      .patch(`/api/v1/recruiter/applications/${a.application.id}/status`)
      .set(bearer(hr))
      .send({ to: 'REVIEWING' })
      .expect(200);
    await http()
      .post(`/api/v1/me/applications/${c.application.id}/withdraw`)
      .set(bearer(c.session))
      .expect(200);

    const res = await http().get('/api/v1/recruiter/stats').set(bearer(hr)).expect(200);
    const stats = (res.body as { data: RecruiterStats }).data;
    expect(stats.jobs.map((job) => job.jobId)).toEqual([draft.id, second.id, first.id]);
    expect(stats.jobs[0]).toMatchObject({ status: 'DRAFT', total: 0, byStatus: zero });
    expect(stats.jobs[1]).toMatchObject({
      title: `Thực tập thống kê Hai ${runId}`,
      total: 1,
      byStatus: { ...zero, SUBMITTED: 1 },
    });
    expect(stats.jobs[2]).toMatchObject({
      total: 3,
      byStatus: { ...zero, SUBMITTED: 1, REVIEWING: 1, WITHDRAWN: 1 },
    });
    expect(stats.totals).toEqual({
      total: 4,
      byStatus: { ...zero, SUBMITTED: 2, REVIEWING: 1, WITHDRAWN: 1 },
    });
  });

  it('admin: đủ N ngày tới hôm nay (giờ VN); đơn mới tăng đúng hôm nay và SUBMITTED', async () => {
    const before = await adminStats('?days=7');
    expect(before.days).toBe(7);
    expect(before.applicationsPerDay).toHaveLength(7);
    expect(before.applicationsPerDay.at(-1)?.date).toBe(vnDate(new Date()));
    expect(Object.keys(before.applicationsByStatus).sort()).toEqual(Object.keys(zero).sort());
    expect(Object.keys(before.jobsByStatus).sort()).toEqual([
      'CLOSED',
      'DRAFT',
      'PUBLISHED',
      'hidden',
    ]);

    await apply(second);
    const after = await adminStats('?days=7');
    expect(after.applicationsPerDay.at(-1)?.count).toBe(
      (before.applicationsPerDay.at(-1)?.count ?? 0) + 1,
    );
    expect(after.applicationsByStatus.SUBMITTED).toBe(before.applicationsByStatus.SUBMITTED + 1);
  });

  it('admin: top công ty giảm dần, tối đa 5, tên theo ?lang', async () => {
    const vi = await adminStats();
    expect(vi.days).toBe(30);
    expect(vi.topCompanies.length).toBeLessThanOrEqual(5);
    const counts = vi.topCompanies.map((company) => company.applicationCount);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));

    const mine = (stats: AdminStats) =>
      stats.topCompanies.find((company) => company.id === hr.user.companyId);
    // Công ty của test có 5 đơn hôm nay; chỉ kiểm tên khi nó lọt top 5 trên DB dev.
    if (mine(vi)) {
      expect(mine(vi)).toMatchObject({ name: `Công ty Thống Kê ${runId}`, applicationCount: 5 });
      expect(mine(await adminStats('?lang=en'))?.name).toBe(`Stats Co ${runId}`);
    }
  });

  it('admin: số công ty chờ duyệt tăng khi có nhà tuyển dụng mới đăng ký', async () => {
    const before = (await adminStats()).pendingCompanies;
    await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: 'HR chờ duyệt',
        company: { translations: { vi: { name: `Công ty Chờ ${runId}` } } },
      })
      .expect(201);
    expect((await adminStats()).pendingCompanies).toBe(before + 1);
  });

  it('days ngoài 1–365 thì 400; sai vai trò thì 403', async () => {
    await http().get('/api/v1/admin/stats?days=0').set(asAdmin()).expect(400);
    await http().get('/api/v1/admin/stats?days=400').set(asAdmin()).expect(400);
    await http().get('/api/v1/admin/stats').set(bearer(hr)).expect(403);
    await http().get('/api/v1/recruiter/stats').set(asAdmin()).expect(403);
  });
});
