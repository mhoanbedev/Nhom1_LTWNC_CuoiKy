import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  ApiError,
  ApplicationNote,
  AuthResponse,
  CandidateApplication,
  CvFile,
  RecruiterApplication,
  RecruiterJob,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';

const PDF = Buffer.from('%PDF-1.4\n%%EOF');
const SECRET = 'Kỹ năng React tốt, hỏi thêm về dự án';

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

describe('Ghi chú nội bộ của nhà tuyển dụng (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let hrA: AuthResponse;
  let hrB: AuthResponse;
  let candidate: AuthResponse;
  let applicationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CloudinaryService)
      .useValue(fakeCloudinary)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await seedCatalogs(dataSource.manager);
    const skills = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    const skillId = skills[0]?.id ?? '';

    hrA = await newRecruiter('A');
    hrB = await newRecruiter('B');
    const jobRes = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hrA))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập ghi chú ${runId}` } },
      })
      .expect(201);
    const job = (jobRes.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hrA)).expect(200);

    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng Viên' })
      .expect(201);
    candidate = (res.body as { data: AuthResponse }).data;
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(candidate)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    const cvRes = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(candidate))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    const cv = (cvRes.body as { data: CvFile }).data;
    const applied = await http()
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set(bearer(candidate))
      .send({ cvFileId: cv.id })
      .expect(201);
    applicationId = (applied.body as { data: CandidateApplication }).data.id;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-note-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const nextEmail = () => `e2e-note-${runId}-${(counter += 1)}@test.local`;
  const notesUrl = () => `/api/v1/recruiter/applications/${applicationId}/notes`;

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: `HR ${label}`,
        company: { translations: { vi: { name: `Công ty Ghi Chú ${label} ${runId}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
      session.user.companyId,
    ]);
    return session;
  }

  it('thêm ghi chú: mới nhất lên trước, có tên người viết, nội dung được bỏ khoảng trắng thừa', async () => {
    await http()
      .post(notesUrl())
      .set(bearer(hrA))
      .send({ content: 'Ghi chú đầu tiên' })
      .expect(201);
    const res = await http()
      .post(notesUrl())
      .set(bearer(hrA))
      .send({ content: `  ${SECRET}  ` })
      .expect(201);
    const notes = (res.body as { data: ApplicationNote[] }).data;
    expect(notes.map((note) => note.content)).toEqual([SECRET, 'Ghi chú đầu tiên']);
    expect(notes[0]?.author).toEqual({ id: hrA.user.id, name: 'HR A' });

    const list = await http().get(notesUrl()).set(bearer(hrA)).expect(200);
    expect((list.body as { data: ApplicationNote[] }).data).toHaveLength(2);
  });

  it('chi tiết đơn phía nhà tuyển dụng có notes', async () => {
    const res = await http()
      .get(`/api/v1/recruiter/applications/${applicationId}`)
      .set(bearer(hrA))
      .expect(200);
    const detail = (res.body as { data: RecruiterApplication }).data;
    expect(detail.notes.map((note) => note.content)).toContain(SECRET);
  });

  it('ứng viên không bao giờ thấy ghi chú nội bộ', async () => {
    const detail = await http()
      .get(`/api/v1/me/applications/${applicationId}`)
      .set(bearer(candidate))
      .expect(200);
    expect(detail.body).not.toHaveProperty('data.notes');
    expect(JSON.stringify(detail.body)).not.toContain(SECRET);
    const list = await http().get('/api/v1/me/applications').set(bearer(candidate)).expect(200);
    expect(JSON.stringify(list.body)).not.toContain(SECRET);
    // Gọi thẳng API ghi chú cũng bị chặn.
    await http().get(notesUrl()).set(bearer(candidate)).expect(403);
  });

  it('nhà tuyển dụng công ty khác: xem, thêm ghi chú đều 404', async () => {
    await http().get(notesUrl()).set(bearer(hrB)).expect(404);
    await http().post(notesUrl()).set(bearer(hrB)).send({ content: 'Chen ngang' }).expect(404);
  });

  it('nội dung rỗng hoặc quá 2000 ký tự: 400', async () => {
    await http().post(notesUrl()).set(bearer(hrA)).send({ content: '   ' }).expect(400);
    const res = await http()
      .post(notesUrl())
      .set(bearer(hrA))
      .send({ content: 'a'.repeat(2001) })
      .expect(400);
    expect((res.body as ApiError).code).toBe('VALIDATION_FAILED');
  });
});
