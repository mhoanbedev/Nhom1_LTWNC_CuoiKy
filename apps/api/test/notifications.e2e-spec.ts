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

describe('Thông báo (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let hr: AuthResponse;
  let job: RecruiterJob;

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

    hr = await newRecruiter('Chính');
    await approve(hr);
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: {
          vi: { title: `Thực tập thông báo ${runId}` },
          en: { title: `Notification intern ${runId}` },
        },
      })
      .expect(201);
    job = (res.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    await readAll(hr);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-notif-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const nextEmail = () => `e2e-notif-${runId}-${(counter += 1)}@test.local`;

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: `HR ${label}`,
        company: {
          translations: {
            vi: { name: `Công ty Thông Báo ${label} ${runId}` },
            en: { name: `Notify Co ${label} ${runId}` },
          },
        },
      })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const approve = (session: AuthResponse) =>
    http()
      .patch(`/api/v1/admin/companies/${session.user.companyId}/approve`)
      .set({ Authorization: `Bearer ${admin.token}` })
      .expect(200);

  async function appliedCandidate(): Promise<{
    session: AuthResponse;
    application: CandidateApplication;
  }> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Nguyễn An' })
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

  const list = async (session: AuthResponse, query = '') =>
    (await http().get(`/api/v1/me/notifications${query}`).set(bearer(session)).expect(200))
      .body as Paginated<NotificationItem>;
  const unread = async (session: AuthResponse) =>
    (
      (await http().get('/api/v1/me/notifications/unread-count').set(bearer(session)).expect(200))
        .body as { data: { count: number } }
    ).data.count;
  const readAll = (session: AuthResponse) =>
    http().post('/api/v1/me/notifications/read-all').set(bearer(session)).expect(200);

  it('nộp đơn: nhà tuyển dụng nhận NEW_APPLICATION, câu đã dịch, data chỉ chứa tham số', async () => {
    const { application } = await appliedCandidate();
    expect(await unread(hr)).toBe(1);
    const latest = (await list(hr)).data[0];
    expect(latest).toMatchObject({
      type: 'NEW_APPLICATION',
      title: 'Có đơn ứng tuyển mới',
      body: `Nguyễn An vừa ứng tuyển vào tin "Thực tập thông báo ${runId}"`,
      readAt: null,
      data: { applicationId: application.id, jobId: job.id, candidateName: 'Nguyễn An' },
    });
    // DB chỉ lưu tham số, không lưu câu chữ.
    const rows = await dataSource.query<{ data: object }[]>(
      `SELECT data FROM notifications WHERE id = $1`,
      [latest?.id],
    );
    expect(JSON.stringify(rows[0]?.data)).not.toContain('Có đơn ứng tuyển mới');
    await readAll(hr);
  });

  it('nộp trùng (409) không sinh thông báo "ma"', async () => {
    const { session, application } = await appliedCandidate();
    await readAll(hr);
    const cvId = (
      (await http().get(`/api/v1/me/applications/${application.id}`).set(bearer(session))).body as {
        data: CandidateApplication;
      }
    ).data.cv.id;
    await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(session))
      .send({ cvFileId: cvId })
      .expect(409);
    expect(await unread(hr)).toBe(0);
  });

  it('đổi trạng thái: ứng viên nhận kèm ghi chú; ?lang=en và ngôn ngữ ưa thích đều đúng', async () => {
    const { session, application } = await appliedCandidate();
    await http()
      .patch(`/api/v1/recruiter/applications/${application.id}/status`)
      .set(bearer(hr))
      .send({ to: 'REVIEWING', note: 'Đã xem CV' })
      .expect(200);

    const vi = (await list(session)).data[0];
    expect(vi).toMatchObject({
      type: 'APPLICATION_STATUS_CHANGED',
      title: 'Hồ sơ ứng tuyển của bạn được cập nhật',
      body: `"Thực tập thông báo ${runId}": Đã nộp → Đang xem xét. Ghi chú: Đã xem CV`,
    });
    const en = (await list(session, '?lang=en')).data[0];
    expect(en?.body).toBe(
      `"Notification intern ${runId}": Submitted → Under review. Note: Đã xem CV`,
    );

    // Không có ?lang thì theo ngôn ngữ ưa thích của tài khoản.
    await http()
      .patch('/api/v1/auth/me')
      .set(bearer(session))
      .send({ preferredLocale: 'en' })
      .expect(200);
    expect((await list(session)).data[0]?.title).toBe('Your application was updated');
  });

  it('ứng viên rút đơn: nhà tuyển dụng nhận câu riêng', async () => {
    const { session, application } = await appliedCandidate();
    await readAll(hr);
    await http()
      .post(`/api/v1/me/applications/${application.id}/withdraw`)
      .set(bearer(session))
      .expect(200);
    expect((await list(hr)).data[0]).toMatchObject({
      title: 'Ứng viên đã rút đơn',
      body: `Nguyễn An đã rút đơn ứng tuyển vào tin "Thực tập thông báo ${runId}"`,
    });
  });

  it('admin duyệt: báo một lần (duyệt lại không báo); từ chối: báo kèm lý do', async () => {
    const other = await newRecruiter('Phụ');
    await approve(other);
    await approve(other);
    const approved = await list(other);
    expect(approved.data.filter((item) => item.type === 'COMPANY_APPROVED')).toHaveLength(1);
    expect(approved.data[0]?.body).toBe(
      `Công ty Thông Báo Phụ ${runId} đã được duyệt, bạn có thể đăng tin tuyển dụng.`,
    );

    await http()
      .patch(`/api/v1/admin/companies/${other.user.companyId}/reject`)
      .set({ Authorization: `Bearer ${admin.token}` })
      .send({ reason: 'Thiếu mã số thuế' })
      .expect(200);
    expect((await list(other, '?lang=en')).data[0]).toMatchObject({
      type: 'COMPANY_REJECTED',
      body: `Notify Co Phụ ${runId} was rejected. Reason: Thiếu mã số thuế. Update your company information to resubmit.`,
    });
  });

  it('đọc một, lọc chưa đọc, đọc tất cả; thông báo của người khác 404', async () => {
    // Bắt đầu từ 0 chưa đọc, không phụ thuộc thông báo các test trước để lại.
    await readAll(hr);
    const { session } = await appliedCandidate();
    await appliedCandidate();
    expect(await unread(hr)).toBe(2);

    const [first] = (await list(hr, '?unread=true')).data;
    const read = await http()
      .patch(`/api/v1/me/notifications/${first?.id}/read`)
      .set(bearer(hr))
      .expect(200);
    expect((read.body as { data: NotificationItem }).data.readAt).not.toBeNull();
    await http().patch(`/api/v1/me/notifications/${first?.id}/read`).set(bearer(hr)).expect(200);
    expect(await unread(hr)).toBe(1);
    expect((await list(hr, '?unread=true')).meta.total).toBe(1);

    await http()
      .patch(`/api/v1/me/notifications/${first?.id}/read`)
      .set(bearer(session))
      .expect(404);

    const all = await readAll(hr);
    expect((all.body as { data: { updated: number } }).data.updated).toBe(1);
    expect(await unread(hr)).toBe(0);
  });
});
