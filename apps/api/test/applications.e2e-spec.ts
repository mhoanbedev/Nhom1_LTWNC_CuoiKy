import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  ApiError,
  AuthResponse,
  CandidateApplication,
  CvFile,
  Paginated,
  CandidateApplicationListItem,
  PublicJobDetail,
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

/** Cloudinary giả cho upload CV. */
const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
};

describe('Nộp đơn, chống nộp trùng (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let recruiter: AuthResponse;
  let openJob: RecruiterJob;

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
    const rows = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    skillId = rows[0]?.id ?? '';

    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-apply-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'HR',
        company: { translations: { vi: { name: `Công ty Ứng Tuyển ${runId}` } } },
      })
      .expect(201);
    recruiter = (res.body as { data: AuthResponse }).data;
    await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
      recruiter.user.companyId,
    ]);
    openJob = await createJob({ publish: true });
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-apply-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const errorOf = (res: request.Response) => res.body as ApiError;

  async function createJob({ publish }: { publish: boolean }): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(recruiter))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập ứng tuyển ${runId}` } },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    if (publish) {
      await http()
        .post(`/api/v1/recruiter/jobs/${job.id}/publish`)
        .set(bearer(recruiter))
        .expect(200);
    }
    return job;
  }

  async function newCandidate(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-apply-${runId}-${counter}@test.local`, password: 'abc12345', name: 'An' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  /** Ứng viên xong 3 bước bắt buộc và có 1 CV. */
  async function readyCandidate(): Promise<{ session: AuthResponse; cv: CvFile }> {
    const session = await newCandidate();
    const put = (step: string, body: object) =>
      http().put(`/api/v1/me/profile/${step}`).set(bearer(session)).send(body).expect(200);
    await put('basic', { headline: 'Sinh viên CNTT' });
    await put('education', { items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09' }] });
    await put('skills', { items: [{ skillId, level: 4 }] });
    const cv = await uploadCv(session);
    return { session, cv };
  }

  async function uploadCv(session: AuthResponse): Promise<CvFile> {
    const res = await http()
      .post('/api/v1/me/cvs')
      .set(bearer(session))
      .attach('file', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    return (res.body as { data: CvFile }).data;
  }

  const apply = (session: AuthResponse, jobId: string, body: object) =>
    http().post(`/api/v1/jobs/${jobId}/applications`).set(bearer(session)).send(body);

  describe('nộp thành công', () => {
    it('đơn SUBMITTED, kèm CV, thư xin việc và 1 dòng lịch sử do ứng viên tạo', async () => {
      const { session, cv } = await readyCandidate();
      const res = await apply(session, openJob.id, {
        cvFileId: cv.id,
        coverLetter: '  Em xin ứng tuyển  ',
      }).expect(201);
      const application = (res.body as { data: CandidateApplication }).data;
      expect(application).toMatchObject({
        status: 'SUBMITTED',
        coverLetter: 'Em xin ứng tuyển',
        cv: { id: cv.id, originalName: 'cv.pdf' },
        job: { id: openJob.id, title: `Thực tập ứng tuyển ${runId}` },
      });
      expect(application.history).toEqual([
        expect.objectContaining({
          fromStatus: null,
          toStatus: 'SUBMITTED',
          changedBy: 'CANDIDATE',
        }),
      ]);
    });

    it('nộp lại cùng tin: 409 APPLICATION_DUPLICATE', async () => {
      const { session, cv } = await readyCandidate();
      await apply(session, openJob.id, { cvFileId: cv.id }).expect(201);
      const res = await apply(session, openJob.id, { cvFileId: cv.id }).expect(409);
      expect(errorOf(res).code).toBe('APPLICATION_DUPLICATE');
    });

    it('bấm nộp 2 lần cùng lúc: chỉ tạo 1 đơn', async () => {
      const { session, cv } = await readyCandidate();
      const results = await Promise.all([
        apply(session, openJob.id, { cvFileId: cv.id }),
        apply(session, openJob.id, { cvFileId: cv.id }),
      ]);
      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      const rows = await dataSource.query<{ count: string }[]>(
        `SELECT count(*) FROM applications WHERE candidate_id = $1`,
        [session.user.id],
      );
      expect(rows[0]?.count).toBe('1');
    });

    it('ảnh chụp hồ sơ không đổi khi ứng viên sửa hồ sơ sau đó', async () => {
      const { session, cv } = await readyCandidate();
      const res = await apply(session, openJob.id, { cvFileId: cv.id }).expect(201);
      const id = (res.body as { data: CandidateApplication }).data.id;
      await http()
        .put('/api/v1/me/profile/basic')
        .set(bearer(session))
        .send({ headline: 'Đã đổi sau khi nộp' })
        .expect(200);
      const rows = await dataSource.query<{ headline: string }[]>(
        `SELECT profile_snapshot->'profile'->'basic'->>'headline' AS headline FROM applications WHERE id = $1`,
        [id],
      );
      expect(rows[0]?.headline).toBe('Sinh viên CNTT');
    });
  });

  describe('các nhánh lỗi theo thứ tự mục 5.3', () => {
    it('1. nhà tuyển dụng nộp đơn: 403', async () => {
      await apply(recruiter, openJob.id, {
        cvFileId: '00000000-0000-4000-8000-000000000000',
      }).expect(403);
    });

    it('2. tin nháp hay không tồn tại: 404; tin đã đóng: 400 JOB_NOT_ACCEPTING', async () => {
      const { session, cv } = await readyCandidate();
      const draft = await createJob({ publish: false });
      await apply(session, draft.id, { cvFileId: cv.id }).expect(404);
      await apply(session, '00000000-0000-4000-8000-000000000000', { cvFileId: cv.id }).expect(404);

      const closed = await createJob({ publish: true });
      await http()
        .post(`/api/v1/recruiter/jobs/${closed.id}/close`)
        .set(bearer(recruiter))
        .expect(200);
      const res = await apply(session, closed.id, { cvFileId: cv.id }).expect(400);
      expect(errorOf(res).code).toBe('JOB_NOT_ACCEPTING');
    });

    it('3. hồ sơ thiếu bước: 400 PROFILE_INCOMPLETE, details là bước còn thiếu (đã dịch)', async () => {
      const session = await newCandidate();
      await http()
        .put('/api/v1/me/profile/basic')
        .set(bearer(session))
        .send({ headline: 'Mới bắt đầu' })
        .expect(200);
      const cv = await uploadCv(session);
      const res = await apply(session, openJob.id, { cvFileId: cv.id }).expect(400);
      expect(errorOf(res)).toMatchObject({
        code: 'PROFILE_INCOMPLETE',
        details: [
          { field: 'EDUCATION', message: 'Bước bắt buộc chưa hoàn thành' },
          { field: 'SKILLS', message: 'Bước bắt buộc chưa hoàn thành' },
        ],
      });
    });

    it('4. CV của người khác hoặc CV đã xóa: 400 CV_INVALID', async () => {
      const { session } = await readyCandidate();
      const other = await readyCandidate();
      const res = await apply(session, openJob.id, { cvFileId: other.cv.id }).expect(400);
      expect(errorOf(res).code).toBe('CV_INVALID');

      const own = await uploadCv(session);
      await http().delete(`/api/v1/me/cvs/${own.id}`).set(bearer(session)).expect(204);
      await apply(session, openJob.id, { cvFileId: own.id }).expect(400);
    });

    it('thiếu cvFileId hoặc thư xin việc quá 3000 ký tự: 400 VALIDATION_FAILED', async () => {
      const { session, cv } = await readyCandidate();
      await apply(session, openJob.id, {}).expect(400);
      const res = await apply(session, openJob.id, {
        cvFileId: cv.id,
        coverLetter: 'a'.repeat(3001),
      }).expect(400);
      expect(errorOf(res).code).toBe('VALIDATION_FAILED');
    });
  });

  describe('đơn của tôi và hasApplied', () => {
    it('danh sách, chi tiết của mình; đơn người khác 404', async () => {
      const { session, cv } = await readyCandidate();
      const created = (
        (await apply(session, openJob.id, { cvFileId: cv.id }).expect(201)).body as {
          data: CandidateApplication;
        }
      ).data;

      const list = (await http().get('/api/v1/me/applications').set(bearer(session)).expect(200))
        .body as Paginated<CandidateApplicationListItem>;
      expect(list.meta.total).toBe(1);
      expect(list.data[0]).toMatchObject({ id: created.id, status: 'SUBMITTED' });

      await http().get(`/api/v1/me/applications/${created.id}`).set(bearer(session)).expect(200);
      const stranger = await newCandidate();
      await http().get(`/api/v1/me/applications/${created.id}`).set(bearer(stranger)).expect(404);
    });

    it('chi tiết tin: hasApplied đúng với từng ứng viên', async () => {
      const { session, cv } = await readyCandidate();
      const detail = async (s: AuthResponse) =>
        (
          (
            await http()
              .get(`/api/v1/jobs/${openJob.translations.vi.slug}`)
              .set(bearer(s))
              .expect(200)
          ).body as { data: PublicJobDetail }
        ).data;
      expect((await detail(session)).hasApplied).toBe(false);
      await apply(session, openJob.id, { cvFileId: cv.id }).expect(201);
      expect((await detail(session)).hasApplied).toBe(true);
    });
  });
});
