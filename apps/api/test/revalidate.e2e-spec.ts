import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { AuthResponse, RecruiterJob } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { RevalidateService } from '../src/infrastructure/revalidate/revalidate.service';
import { JobExpiryService } from '../src/modules/jobs/job-expiry.service';
import { adminSession, type AdminSession } from './utils/admin-session';

/** Ghi lại các lần backend báo Next làm mới, thay cho gọi mạng thật. */
class RecordingRevalidate {
  calls: string[][] = [];
  notify(tags: string[]) {
    this.calls.push([...new Set(tags)]);
  }
  reset() {
    this.calls = [];
  }
  get last(): string[] | undefined {
    return this.calls.at(-1);
  }
}

describe('Webhook revalidate và cron đóng tin hết hạn (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const revalidate = new RecordingRevalidate();
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let recruiter: AuthResponse;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevalidateService)
      .useValue(revalidate)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    admin = await adminSession(app, dataSource);
    await seedCatalogs(dataSource.manager);
    const rows = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    skillId = rows[0]?.id ?? '';
    recruiter = await newRecruiter();
    await http()
      .patch(`/api/v1/admin/companies/${companyId(recruiter)}/approve`)
      .set(bearer(admin.token))
      .expect(200);
  });

  beforeEach(() => revalidate.reset());

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-reval-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const companyId = (session: AuthResponse) => session.user.companyId ?? '';

  async function newRecruiter(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-reval-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'Chị HR',
        company: { translations: { vi: { name: `Công ty Làm Mới ${runId} ${counter}` } } },
      })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  async function createJob(): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(recruiter.accessToken))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập làm mới ${runId}` } },
      })
      .expect(201);
    return (res.body as { data: RecruiterJob }).data;
  }

  const jobAction = (job: RecruiterJob, action: string, body: object = {}) =>
    http()
      .post(`/api/v1/recruiter/jobs/${job.id}/${action}`)
      .set(bearer(recruiter.accessToken))
      .send(body);

  const jobTags = (job: RecruiterJob) => [
    `job:${job.id}`,
    `company:${companyId(recruiter)}`,
    'jobs:list',
    'sitemap',
  ];

  describe('tin', () => {
    it('tin nháp: tạo, sửa không báo (chưa có trang công khai)', async () => {
      const job = await createJob();
      await http()
        .patch(`/api/v1/recruiter/jobs/${job.id}`)
        .set(bearer(recruiter.accessToken))
        .send({ quantity: 2 })
        .expect(200);
      expect(revalidate.calls).toEqual([]);
    });

    it('đăng, sửa tin đang đăng, đóng, mở lại: mỗi lần báo đúng tag của tin', async () => {
      const job = await createJob();
      await jobAction(job, 'publish').expect(200);
      expect(revalidate.last).toEqual(jobTags(job));

      await http()
        .patch(`/api/v1/recruiter/jobs/${job.id}`)
        .set(bearer(recruiter.accessToken))
        .send({ quantity: 3 })
        .expect(200);
      await jobAction(job, 'close').expect(200);
      await jobAction(job, 'reopen', { expiresAt: '2032-01-31T17:00:00.000Z' }).expect(200);
      expect(revalidate.calls).toEqual([jobTags(job), jobTags(job), jobTags(job), jobTags(job)]);
    });

    it('thao tác bị từ chối (đăng tin thiếu điều kiện) thì không báo', async () => {
      const res = await http()
        .post('/api/v1/recruiter/jobs')
        .set(bearer(recruiter.accessToken))
        .send({ translations: { vi: { title: `Thực tập thiếu ${runId}` } } })
        .expect(201);
      await jobAction((res.body as { data: RecruiterJob }).data, 'publish').expect(400);
      expect(revalidate.calls).toEqual([]);
    });
  });

  describe('công ty', () => {
    const companyTags = (id: string) => [`company:${id}`, 'companies:list', 'jobs:list', 'sitemap'];

    it('sửa công ty đã duyệt thì báo; công ty chưa duyệt thì không', async () => {
      await http()
        .put('/api/v1/recruiter/company')
        .set(bearer(recruiter.accessToken))
        .send({ translations: { vi: { name: `Công ty Đổi Tên ${runId}` } } })
        .expect(200);
      expect(revalidate.last).toEqual(companyTags(companyId(recruiter)));

      revalidate.reset();
      const pending = await newRecruiter();
      await http()
        .put('/api/v1/recruiter/company')
        .set(bearer(pending.accessToken))
        .send({ translations: { vi: { name: `Công ty Chờ ${runId}` } } })
        .expect(200);
      expect(revalidate.calls).toEqual([]);
    });

    it('admin duyệt thì báo, duyệt lại không báo; thu hồi duyệt thì báo', async () => {
      const other = await newRecruiter();
      const url = (action: string) => `/api/v1/admin/companies/${companyId(other)}/${action}`;
      await http().patch(url('approve')).set(bearer(admin.token)).expect(200);
      await http().patch(url('approve')).set(bearer(admin.token)).expect(200);
      expect(revalidate.calls).toEqual([companyTags(companyId(other))]);

      await http()
        .patch(url('reject'))
        .set(bearer(admin.token))
        .send({ reason: 'Thông tin sai lệch' })
        .expect(200);
      expect(revalidate.calls).toHaveLength(2);
    });
  });

  describe('cron đóng tin hết hạn', () => {
    it('đóng tin quá hạn, ghi closedAt, báo Next; chạy lại không đóng trùng', async () => {
      const expired = await createJob();
      await jobAction(expired, 'publish').expect(200);
      const stillOpen = await createJob();
      await jobAction(stillOpen, 'publish').expect(200);
      await dataSource.query(
        `UPDATE jobs SET expires_at = now() - interval '1 hour' WHERE id = $1`,
        [expired.id],
      );
      revalidate.reset();

      const expiry = app.get(JobExpiryService);
      const closedIds = await expiry.closeExpired();
      expect(closedIds).toContain(expired.id);
      expect(closedIds).not.toContain(stillOpen.id);
      expect(revalidate.last).toEqual(
        expect.arrayContaining([
          `job:${expired.id}`,
          `company:${companyId(recruiter)}`,
          'jobs:list',
          'sitemap',
        ]),
      );

      const rows = await dataSource.query<{ status: string; closed_at: Date | null }[]>(
        `SELECT status, closed_at FROM jobs WHERE id = $1`,
        [expired.id],
      );
      expect(rows[0]?.status).toBe('CLOSED');
      expect(rows[0]?.closed_at).not.toBeNull();

      expect(await expiry.closeExpired()).not.toContain(expired.id);
    });
  });
});
