import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { AuthResponse, CandidateApplication, CvFile, RecruiterJob } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';
import { MailService, type MailMessage } from '../src/infrastructure/mail/mail.service';
import { adminSession, type AdminSession } from './utils/admin-session';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

/** Ghi lại email thay vì gửi SMTP, để CI không cần Mailpit. */
const sent: MailMessage[] = [];
const fakeMail = { send: (message: MailMessage) => void sent.push(message) };

describe('Email khi đơn đổi trạng thái (e2e)', () => {
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
      .overrideProvider(MailService)
      .useValue(fakeMail)
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
        name: 'HR Email',
        company: {
          translations: {
            vi: { name: `Công ty Email ${runId}` },
            en: { name: `Email Co ${runId}` },
          },
        },
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
        translations: {
          vi: { title: `Thực tập email ${runId}` },
          en: { title: `Email intern ${runId}` },
        },
      })
      .expect(201);
    job = (created.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
  });

  beforeEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-mail-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const nextEmail = () => `e2e-mail-${runId}-${(counter += 1)}@test.local`;

  /** Email gửi nền (không chờ): đợi tối đa 2 giây cho tới khi có `count` email. */
  async function waitForMail(count: number): Promise<void> {
    const deadline = Date.now() + 2000;
    while (sent.length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  async function applied(locale: 'vi' | 'en'): Promise<{ email: string; id: string }> {
    const email = nextEmail();
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email, password: 'abc12345', name: 'Trần Bình', preferredLocale: locale })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    await http()
      .patch('/api/v1/auth/me')
      .set(bearer(session))
      .send({ preferredLocale: locale })
      .expect(200);
    const cv = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(session))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    const application = await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(session))
      .send({ cvFileId: (cv.body as { data: CvFile }).data.id })
      .expect(201);
    return { email, id: (application.body as { data: CandidateApplication }).data.id };
  }

  const move = (id: string, to: string, note?: string) =>
    http()
      .patch(`/api/v1/recruiter/applications/${id}/status`)
      .set(bearer(hr))
      .send({ to, ...(note && { note }) });

  it('REVIEWING không gửi; INTERVIEW gửi ứng viên, tiếng Việt, kèm lời nhắn', async () => {
    const { email, id } = await applied('vi');
    await move(id, 'REVIEWING').expect(200);
    await move(id, 'INTERVIEW', 'Phỏng vấn 9h thứ Hai').expect(200);
    await waitForMail(1);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: email,
      subject: `[Thực tập email ${runId}] Hồ sơ ứng tuyển: Phỏng vấn`,
    });
    expect(sent[0]?.text).toContain(`Công ty Email ${runId} mời bạn phỏng vấn`);
    expect(sent[0]?.text).toContain('Lời nhắn từ nhà tuyển dụng: Phỏng vấn 9h thứ Hai');
    expect(sent[0]?.text).toContain('http://localhost:3000/vi');
  });

  it('ứng viên chọn tiếng Anh: email tiếng Anh, tên tin và công ty bản en', async () => {
    const { id } = await applied('en');
    await move(id, 'FAILED').expect(200);
    await waitForMail(1);
    expect(sent[0]?.subject).toBe(`[Email intern ${runId}] Application update: Not selected`);
    expect(sent[0]?.text).toContain(`"Email intern ${runId}" at Email Co ${runId}`);
  });

  it('đổi trạng thái lỗi (409 hay chuyển sai) thì không gửi', async () => {
    const { id } = await applied('vi');
    await move(id, 'PASSED').expect(400);
    await move(id, 'REVIEWING').expect(200);
    const [first, second] = await Promise.all([move(id, 'INTERVIEW'), move(id, 'INTERVIEW')]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    await waitForMail(2);
    expect(sent).toHaveLength(1);
  });
});
