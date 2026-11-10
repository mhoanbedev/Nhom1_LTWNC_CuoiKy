import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AuthResponse,
  CandidateApplication,
  CvFile,
  NotificationItem,
  Paginated,
  RecruiterJob,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { adminSession, type AdminSession } from './utils/admin-session';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

/** Số lần gửi cùng lúc cho mỗi kịch bản. */
const PARALLEL = 5;

describe('Đồng thời (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;

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
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-conc-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-conc-${runId}-${(counter += 1)}@test.local`;
  const times = <T>(run: () => Promise<T>) => Promise.all(Array.from({ length: PARALLEL }, run));
  const statuses = (responses: { status: number }[]) =>
    responses.map((res) => res.status).sort((a, b) => a - b);

  async function newRecruiter(approve = true): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: 'HR đồng thời',
        company: { translations: { vi: { name: `Công ty Đồng Thời ${counter} ${runId}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    if (approve) {
      await http()
        .patch(`/api/v1/admin/companies/${session.user.companyId}/approve`)
        .set(asAdmin())
        .expect(200);
    }
    return session;
  }

  async function newJob(hr: AuthResponse, publish = true): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập đồng thời ${counter} ${runId}` } },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    if (publish) {
      await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    }
    return job;
  }

  async function newCandidate(): Promise<{ session: AuthResponse; cv: CvFile }> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng viên đồng thời' })
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
    return { session, cv: (cvRes.body as { data: CvFile }).data };
  }

  /** Số thông báo loại `type` của một người (đọc thẳng DB, không phụ thuộc phân trang). */
  async function countNotifications(userId: string, type: string): Promise<number> {
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM notifications WHERE user_id = $1 AND type = $2`,
      [userId, type],
    );
    return Number(rows[0]?.count ?? 0);
  }

  it('đăng ký cùng một email cùng lúc: một 201, còn lại 409, chỉ 1 user', async () => {
    const email = nextEmail();
    const responses = await times(() =>
      http()
        .post('/api/v1/auth/register/candidate')
        .send({ email, password: 'abc12345', name: 'Trùng email' }),
    );
    expect(statuses(responses)).toEqual([201, ...Array<number>(PARALLEL - 1).fill(409)]);
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM users WHERE email = $1`,
      [email],
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('admin duyệt một công ty nhiều lần cùng lúc: đều 200, chỉ 1 thông báo COMPANY_APPROVED', async () => {
    const hr = await newRecruiter(false);
    const responses = await times(() =>
      http().patch(`/api/v1/admin/companies/${hr.user.companyId}/approve`).set(asAdmin()),
    );
    expect(statuses(responses)).toEqual(Array<number>(PARALLEL).fill(200));
    expect(await countNotifications(hr.user.id, 'COMPANY_APPROVED')).toBe(1);
  });

  it('admin ẩn một tin nhiều lần cùng lúc: đều 200, chỉ 1 thông báo JOB_HIDDEN', async () => {
    const hr = await newRecruiter();
    const job = await newJob(hr);
    const responses = await times(() =>
      http()
        .patch(`/api/v1/admin/jobs/${job.id}/hide`)
        .set(asAdmin())
        .send({ reason: 'Nội dung sai sự thật' }),
    );
    expect(statuses(responses)).toEqual(Array<number>(PARALLEL).fill(200));
    expect(await countNotifications(hr.user.id, 'JOB_HIDDEN')).toBe(1);
  });

  it('ứng viên rút đơn đúng lúc nhà tuyển dụng đổi trạng thái: một bên thắng, bên kia 409', async () => {
    const hr = await newRecruiter();
    const job = await newJob(hr);
    const { session, cv } = await newCandidate();
    const applied = await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(session))
      .send({ cvFileId: cv.id })
      .expect(201);
    const application = (applied.body as { data: CandidateApplication }).data;

    const [withdraw, review] = await Promise.all([
      http().post(`/api/v1/me/applications/${application.id}/withdraw`).set(bearer(session)),
      http()
        .patch(`/api/v1/recruiter/applications/${application.id}/status`)
        .set(bearer(hr))
        .send({ to: 'REVIEWING' }),
    ]);
    const codes = [withdraw.status, review.status].sort((a, b) => a - b);
    expect(codes[0]).toBe(200);
    // Bên thua: 409 nếu đọc trạng thái cũ, hoặc 400 nếu đọc sau khi bên thắng đã đổi xong.
    expect([400, 409]).toContain(codes[1]);

    // Lịch sử: bước nộp + đúng 1 lần đổi; trạng thái cuối khớp lịch sử.
    const history = await dataSource.query<{ to_status: string }[]>(
      `SELECT to_status FROM application_status_histories WHERE application_id = $1 ORDER BY created_at`,
      [application.id],
    );
    expect(history).toHaveLength(2);
    const current = await dataSource.query<{ status: string }[]>(
      `SELECT status FROM applications WHERE id = $1`,
      [application.id],
    );
    expect(current[0]?.status).toBe(history[1]?.to_status);
  });

  it('lưu một tin nhiều lần cùng lúc: đều 204, chỉ 1 dòng', async () => {
    const hr = await newRecruiter();
    const job = await newJob(hr);
    const { session } = await newCandidate();
    const responses = await times(() =>
      http().put(`/api/v1/me/saved-jobs/${job.id}`).set(bearer(session)),
    );
    expect(statuses(responses)).toEqual(Array<number>(PARALLEL).fill(204));
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2`,
      [session.user.id, job.id],
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('đăng một tin nháp nhiều lần cùng lúc: một 200, còn lại lỗi 4xx rõ ràng, không 500', async () => {
    const hr = await newRecruiter();
    const job = await newJob(hr, false);
    const responses = await times(() =>
      http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)),
    );
    const codes = statuses(responses);
    expect(codes.filter((code) => code === 200)).toHaveLength(1);
    expect(codes.every((code) => code < 500)).toBe(true);

    const detail = await http().get(`/api/v1/recruiter/jobs/${job.id}`).set(bearer(hr)).expect(200);
    expect((detail.body as { data: RecruiterJob }).data.status).toBe('PUBLISHED');
  });

  it('đọc tất cả thông báo cùng lúc: tổng số đã đánh dấu bằng số chưa đọc ban đầu', async () => {
    const hr = await newRecruiter();
    const job = await newJob(hr);
    for (let n = 0; n < 3; n += 1) {
      const { session, cv } = await newCandidate();
      await http()
        .post(`/api/v1/jobs/${job.id}/applications`)
        .set(bearer(session))
        .send({ cvFileId: cv.id })
        .expect(201);
    }
    const before = (
      (await http().get('/api/v1/me/notifications?unread=true').set(bearer(hr)).expect(200))
        .body as Paginated<NotificationItem>
    ).meta.total;
    const responses = await times(() =>
      http().post('/api/v1/me/notifications/read-all').set(bearer(hr)),
    );
    const updated = responses.reduce(
      (sum, res) => sum + (res.body as { data: { updated: number } }).data.updated,
      0,
    );
    expect(updated).toBe(before);
  });
});
