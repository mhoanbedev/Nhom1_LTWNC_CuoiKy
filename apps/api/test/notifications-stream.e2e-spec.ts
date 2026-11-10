import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { AuthResponse, CvFile, RecruiterJob } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { adminSession, type AdminSession } from './utils/admin-session';
import { openSse, type SseConnection } from './utils/sse-client';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

describe('Thông báo theo thời gian thực: SSE (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  let baseUrl: string;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let hr: AuthResponse;
  let job: RecruiterJob;
  const open: SseConnection[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CloudinaryService)
      .useValue(fakeCloudinary)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1`;
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
        name: 'HR SSE',
        company: { translations: { vi: { name: `Công ty SSE ${runId}` } } },
      })
      .expect(201);
    hr = (res.body as { data: AuthResponse }).data;
    await http()
      .patch(`/api/v1/admin/companies/${hr.user.companyId}/approve`)
      .set({ Authorization: `Bearer ${admin.token}` })
      .expect(200);
    const created = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập SSE ${runId}` } },
      })
      .expect(201);
    job = (created.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    await http().post('/api/v1/me/notifications/read-all').set(bearer(hr)).expect(200);
  });

  afterEach(() => {
    while (open.length > 0) open.pop()?.close();
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-sse-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const nextEmail = () => `e2e-sse-${runId}-${(counter += 1)}@test.local`;

  async function stream(session?: AuthResponse): Promise<SseConnection> {
    const connection = await openSse(`${baseUrl}/me/notifications/stream`, session?.accessToken);
    open.push(connection);
    return connection;
  }

  /** Ứng viên có hồ sơ đủ và một CV; trả phiên và id CV. */
  async function candidateWithCv(): Promise<{ session: AuthResponse; cvId: string }> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng viên SSE' })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    const cv = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(session))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    return { session, cvId: (cv.body as { data: CvFile }).data.id };
  }

  const apply = (session: AuthResponse, cvId: string, status: number) =>
    http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(session))
      .send({ cvFileId: cvId })
      .expect(status);

  it('kết nối: text/event-stream, nhận ngay số chưa đọc (không bọc { data })', async () => {
    const sse = await stream(hr);
    expect(sse.status).toBe(200);
    expect(sse.contentType).toContain('text/event-stream');
    expect(await sse.next()).toEqual({ type: 'unread-count', data: { count: 0 } });
  });

  it('có đơn mới: nhận số +1 sau commit; nộp trùng (409) không có sự kiện; đọc hết về 0', async () => {
    const sse = await stream(hr);
    await sse.next();
    const { session, cvId } = await candidateWithCv();

    await apply(session, cvId, 201);
    expect(await sse.next()).toEqual({ type: 'unread-count', data: { count: 1 } });

    await apply(session, cvId, 409);
    expect(await sse.next(800)).toBeNull();

    await http().post('/api/v1/me/notifications/read-all').set(bearer(hr)).expect(200);
    expect(await sse.next()).toEqual({ type: 'unread-count', data: { count: 0 } });
  });

  it('nhiều tab cùng nhận', async () => {
    const [first, second] = [await stream(hr), await stream(hr)];
    await first.next();
    await second.next();
    const { session, cvId } = await candidateWithCv();
    await apply(session, cvId, 201);
    expect((await first.next())?.data).toEqual({ count: 1 });
    expect((await second.next())?.data).toEqual({ count: 1 });
    await http().post('/api/v1/me/notifications/read-all').set(bearer(hr)).expect(200);
  });

  it('không có token thì 401', async () => {
    const sse = await stream();
    expect(sse.status).toBe(401);
  });

  it('admin khóa tài khoản thì stream đóng', async () => {
    const { session } = await candidateWithCv();
    const sse = await stream(session);
    await sse.next();
    await http()
      .patch(`/api/v1/admin/users/${session.user.id}/lock`)
      .set({ Authorization: `Bearer ${admin.token}` })
      .expect(200);
    expect(await sse.closed()).toBe(true);
  });
});
