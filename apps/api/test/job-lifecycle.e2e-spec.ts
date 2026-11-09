import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse, RecruiterJob } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';

const FUTURE = '2030-06-30T17:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

describe('Vòng đời tin: đăng, đóng, mở lại (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let recruiter: AuthResponse;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await seedCatalogs(dataSource.manager);
    const rows = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    skillId = rows[0]?.id ?? '';
    recruiter = await newRecruiter();
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-life-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const jobOf = (res: request.Response) => (res.body as { data: RecruiterJob }).data;
  const errorOf = (res: request.Response) => res.body as ApiError;

  async function newRecruiter(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-life-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'Chị HR',
        company: { translations: { vi: { name: `Công ty Vòng Đời ${runId} ${counter}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
      session.user.companyId,
    ]);
    return session;
  }

  async function createJob(body: object = {}): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(recruiter))
      .send({ translations: { vi: { title: 'Thực tập vòng đời' } }, ...body })
      .expect(201);
    return jobOf(res);
  }

  const action = (job: RecruiterJob, name: 'publish' | 'close' | 'reopen', body?: object) =>
    http()
      .post(`/api/v1/recruiter/jobs/${job.id}/${name}`)
      .set(bearer(recruiter))
      .send(body ?? {});

  const readyJob = () => createJob({ expiresAt: FUTURE, skills: [{ skillId }] });

  describe('đăng tin', () => {
    it('thiếu điều kiện: 400 JOB_INVALID_TRANSITION, details liệt kê từng điều kiện đã dịch', async () => {
      const job = await createJob();
      const res = await action(job, 'publish').expect(400);
      expect(errorOf(res)).toMatchObject({
        code: 'JOB_INVALID_TRANSITION',
        details: [
          { field: 'expiresAt', message: 'Hạn nhận hồ sơ phải sau thời điểm hiện tại' },
          { field: 'skills', message: 'Tin cần có ít nhất một kỹ năng' },
        ],
      });
    });

    it('details theo ngôn ngữ của request', async () => {
      const job = await createJob({ expiresAt: FUTURE });
      const res = await http()
        .post(`/api/v1/recruiter/jobs/${job.id}/publish?lang=en`)
        .set(bearer(recruiter))
        .expect(400);
      expect(errorOf(res).details).toEqual([
        { field: 'skills', message: 'The job needs at least one skill' },
      ]);
    });

    it('đủ điều kiện: PUBLISHED, ghi publishedAt; đăng lần nữa thì 400', async () => {
      const job = await readyJob();
      const published = jobOf(await action(job, 'publish').expect(200));
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();
      expect(errorOf(await action(job, 'publish').expect(400)).code).toBe('JOB_INVALID_TRANSITION');
    });

    it('công ty bị thu hồi duyệt thì đăng tin trả 403 COMPANY_NOT_APPROVED', async () => {
      const job = await readyJob();
      await dataSource.query(`UPDATE companies SET status = 'REJECTED' WHERE id = $1`, [
        recruiter.user.companyId,
      ]);
      try {
        const res = await action(job, 'publish').expect(403);
        expect(errorOf(res).code).toBe('COMPANY_NOT_APPROVED');
      } finally {
        await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
          recruiter.user.companyId,
        ]);
      }
    });
  });

  describe('sửa tin đang đăng', () => {
    it('không được làm mất điều kiện đăng (hạn đã qua, bỏ hết kỹ năng)', async () => {
      const job = await readyJob();
      await action(job, 'publish').expect(200);
      const patch = (body: object) =>
        http().patch(`/api/v1/recruiter/jobs/${job.id}`).set(bearer(recruiter)).send(body);

      const past = await patch({ expiresAt: PAST }).expect(400);
      expect(errorOf(past).details).toEqual([
        { field: 'expiresAt', message: 'Hạn nhận hồ sơ phải sau thời điểm hiện tại' },
      ]);
      const noSkills = await patch({ skills: [] }).expect(400);
      expect(errorOf(noSkills).details?.[0]?.field).toBe('skills');

      // Sửa nội dung khác vẫn được.
      expect(jobOf(await patch({ quantity: 5 }).expect(200)).quantity).toBe(5);
    });
  });

  describe('đóng và mở lại', () => {
    it('đóng: CLOSED, ghi closedAt; đóng tin nháp hay đóng lần nữa thì 400', async () => {
      const draft = await createJob();
      await action(draft, 'close').expect(400);

      const job = await readyJob();
      await action(job, 'publish').expect(200);
      const closed = jobOf(await action(job, 'close').expect(200));
      expect(closed.status).toBe('CLOSED');
      expect(closed.closedAt).not.toBeNull();
      await action(job, 'close').expect(400);
    });

    it('mở lại cần hạn mới ở tương lai; giữ publishedAt lần đầu, xóa closedAt', async () => {
      const job = await readyJob();
      const published = jobOf(await action(job, 'publish').expect(200));
      await action(job, 'close').expect(200);

      expect(errorOf(await action(job, 'reopen').expect(400)).code).toBe('VALIDATION_FAILED');
      const past = await action(job, 'reopen', { expiresAt: PAST }).expect(400);
      expect(errorOf(past).details?.[0]?.field).toBe('expiresAt');

      const newDeadline = '2031-01-31T17:00:00.000Z';
      const reopened = jobOf(await action(job, 'reopen', { expiresAt: newDeadline }).expect(200));
      expect(reopened).toMatchObject({
        status: 'PUBLISHED',
        expiresAt: newDeadline,
        closedAt: null,
        publishedAt: published.publishedAt,
      });
    });

    it('mở lại tin chưa đóng thì 400', async () => {
      const job = await readyJob();
      await action(job, 'publish').expect(200);
      await action(job, 'reopen', { expiresAt: FUTURE }).expect(400);
    });
  });
});
