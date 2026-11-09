import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  ApiError,
  AuthResponse,
  CandidateApplication,
  CvFile,
  Paginated,
  RecruiterApplication,
  RecruiterApplicationListItem,
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

const fakeCloudinary = {
  uploadPrivateFile: (_buffer: Buffer, options: { folder: string; fileName: string }) =>
    Promise.resolve({ publicId: `${options.folder}/${options.fileName}`, bytes: PDF.length }),
  deletePrivateFile: () => Promise.resolve(),
  privateDownloadUrl: (publicId: string, ttlSeconds: number) => ({
    url: `https://api.cloudinary.test/download?public_id=${encodeURIComponent(publicId)}`,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  }),
};

describe('Xử lý đơn: chuyển trạng thái, lịch sử, rút đơn (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  /** Nhà tuyển dụng công ty A (sở hữu tin) và công ty B (người ngoài). */
  let hrA: AuthResponse;
  let hrB: AuthResponse;
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
    await seedCatalogs(dataSource.manager);
    const rows = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM skills WHERE slug = 'nodejs'`,
    );
    skillId = rows[0]?.id ?? '';
    hrA = await newRecruiter('A');
    hrB = await newRecruiter('B');
    job = await publishedJob(hrA);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-proc-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const errorOf = (res: request.Response) => res.body as ApiError;
  const nextEmail = () => `e2e-proc-${runId}-${(counter += 1)}@test.local`;

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: `HR ${label}`,
        company: { translations: { vi: { name: `Công ty Xử Lý ${label} ${runId}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
      session.user.companyId,
    ]);
    return session;
  }

  async function publishedJob(hr: AuthResponse): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập xử lý đơn ${runId}` } },
      })
      .expect(201);
    const created = (res.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${created.id}/publish`).set(bearer(hr)).expect(200);
    return created;
  }

  /** Ứng viên đủ hồ sơ, có CV, đã nộp vào `job`. */
  async function appliedCandidate(): Promise<{
    session: AuthResponse;
    cv: CvFile;
    application: CandidateApplication;
  }> {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: nextEmail(), password: 'abc12345', name: 'Ứng Viên' })
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
    return { session, cv, application: (applied.body as { data: CandidateApplication }).data };
  }

  const changeStatus = (hr: AuthResponse, id: string, body: object) =>
    http().patch(`/api/v1/recruiter/applications/${id}/status`).set(bearer(hr)).send(body);
  const recruiterView = (res: request.Response) =>
    (res.body as { data: RecruiterApplication }).data;

  describe('nhà tuyển dụng đổi trạng thái', () => {
    it('đi đủ SUBMITTED → REVIEWING → INTERVIEW → PASSED; lịch sử 4 dòng; ứng viên thấy ghi chú', async () => {
      const { session, application } = await appliedCandidate();
      const reviewing = recruiterView(
        await changeStatus(hrA, application.id, { to: 'REVIEWING' }).expect(200),
      );
      expect(reviewing.allowedTransitions).toEqual(['INTERVIEW', 'FAILED']);
      await changeStatus(hrA, application.id, {
        to: 'INTERVIEW',
        note: 'Mời phỏng vấn 9h thứ Hai',
      }).expect(200);
      const passed = recruiterView(
        await changeStatus(hrA, application.id, { to: 'PASSED' }).expect(200),
      );
      expect(passed).toMatchObject({ status: 'PASSED', allowedTransitions: [] });
      expect(passed.history.map((row) => [row.fromStatus, row.toStatus, row.changedBy])).toEqual([
        [null, 'SUBMITTED', 'CANDIDATE'],
        ['SUBMITTED', 'REVIEWING', 'RECRUITER'],
        ['REVIEWING', 'INTERVIEW', 'RECRUITER'],
        ['INTERVIEW', 'PASSED', 'RECRUITER'],
      ]);

      const mine = await http()
        .get(`/api/v1/me/applications/${application.id}`)
        .set(bearer(session))
        .expect(200);
      const history = (mine.body as { data: CandidateApplication }).data.history;
      expect(history.find((row) => row.toStatus === 'INTERVIEW')?.note).toBe(
        'Mời phỏng vấn 9h thứ Hai',
      );
    });

    it('nhảy cóc hoặc đổi đơn đã kết thúc: 400 APPLICATION_INVALID_TRANSITION', async () => {
      const { application } = await appliedCandidate();
      const skip = await changeStatus(hrA, application.id, { to: 'PASSED' }).expect(400);
      expect(errorOf(skip).code).toBe('APPLICATION_INVALID_TRANSITION');
      await changeStatus(hrA, application.id, { to: 'FAILED' }).expect(200);
      await changeStatus(hrA, application.id, { to: 'REVIEWING' }).expect(400);
    });

    it('hai request đổi cùng lúc: chỉ 1 thành công, không ghi đè, lịch sử chỉ 1 dòng', async () => {
      const { application } = await appliedCandidate();
      const results = await Promise.all([
        changeStatus(hrA, application.id, { to: 'REVIEWING' }),
        changeStatus(hrA, application.id, { to: 'REVIEWING' }),
      ]);
      // Request đến sau bị từ chối: đọc trước khi request kia lưu xong thì UPDATE có điều kiện không
      // khớp (409 APPLICATION_STATUS_CONFLICT, đã có unit test riêng); đọc sau thì thấy đơn đã là
      // REVIEWING, REVIEWING → REVIEWING không có trong bảng (400). Thứ tự phụ thuộc thời điểm.
      const statuses = results.map((res) => res.status).sort();
      expect(statuses[0]).toBe(200);
      expect([400, 409]).toContain(statuses[1]);
      const rows = await dataSource.query<{ count: string }[]>(
        `SELECT count(*) FROM application_status_histories
          WHERE application_id = $1 AND to_status = 'REVIEWING'`,
        [application.id],
      );
      expect(rows[0]?.count).toBe('1');
    });

    it('vẫn xử lý được khi tin đã đóng và khi công ty bị thu hồi duyệt', async () => {
      const { application } = await appliedCandidate();
      await http().post(`/api/v1/recruiter/jobs/${job.id}/close`).set(bearer(hrA)).expect(200);
      await dataSource.query(`UPDATE companies SET status = 'REJECTED' WHERE id = $1`, [
        hrA.user.companyId,
      ]);
      try {
        await changeStatus(hrA, application.id, { to: 'REVIEWING' }).expect(200);
      } finally {
        await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
          hrA.user.companyId,
        ]);
        await http()
          .post(`/api/v1/recruiter/jobs/${job.id}/reopen`)
          .set(bearer(hrA))
          .send({ expiresAt: '2031-06-30T17:00:00.000Z' })
          .expect(200);
      }
    });
  });

  describe('danh sách, chi tiết, tải CV', () => {
    it('danh sách đơn của tin, lọc theo trạng thái, có thông tin ứng viên từ ảnh chụp hồ sơ', async () => {
      const { application } = await appliedCandidate();
      await changeStatus(hrA, application.id, { to: 'REVIEWING' }).expect(200);
      const res = await http()
        .get(`/api/v1/recruiter/jobs/${job.id}/applications?status=REVIEWING`)
        .set(bearer(hrA))
        .expect(200);
      const page = res.body as Paginated<RecruiterApplicationListItem>;
      expect(page.data.every((row) => row.status === 'REVIEWING')).toBe(true);
      expect(page.data.find((row) => row.id === application.id)).toMatchObject({
        candidate: { name: 'Ứng Viên', headline: 'Sinh viên CNTT' },
        cv: { originalName: 'cv.pdf' },
      });
    });

    it('nhà tuyển dụng tải được CV của đơn, kể cả khi ứng viên đã xóa CV đó', async () => {
      const { session, cv } = await appliedCandidate();
      await http().get(`/api/v1/files/cvs/${cv.id}`).set(bearer(hrA)).expect(200);
      await http().delete(`/api/v1/me/cvs/${cv.id}`).set(bearer(session)).expect(204);
      await http().get(`/api/v1/files/cvs/${cv.id}`).set(bearer(hrA)).expect(200);
      // Chủ CV đã xóa thì chính họ không tải nữa.
      await http().get(`/api/v1/files/cvs/${cv.id}`).set(bearer(session)).expect(404);
    });

    it('nhà tuyển dụng công ty khác: xem danh sách, chi tiết, đổi trạng thái, tải CV đều 404', async () => {
      const { cv, application } = await appliedCandidate();
      await http()
        .get(`/api/v1/recruiter/jobs/${job.id}/applications`)
        .set(bearer(hrB))
        .expect(404);
      await http()
        .get(`/api/v1/recruiter/applications/${application.id}`)
        .set(bearer(hrB))
        .expect(404);
      await changeStatus(hrB, application.id, { to: 'REVIEWING' }).expect(404);
      await http().get(`/api/v1/files/cvs/${cv.id}`).set(bearer(hrB)).expect(404);
    });
  });

  describe('ứng viên rút đơn', () => {
    it('rút đơn đang mở; rút lần nữa 400; nhà tuyển dụng thấy WITHDRAWN, hết nút chuyển', async () => {
      const { session, application } = await appliedCandidate();
      const withdraw = () =>
        http().post(`/api/v1/me/applications/${application.id}/withdraw`).set(bearer(session));
      const res = await withdraw().expect(200);
      const mine = (res.body as { data: CandidateApplication }).data;
      expect(mine.status).toBe('WITHDRAWN');
      expect(mine.history.at(-1)).toMatchObject({
        fromStatus: 'SUBMITTED',
        toStatus: 'WITHDRAWN',
        changedBy: 'CANDIDATE',
      });
      expect(errorOf(await withdraw().expect(400)).code).toBe('APPLICATION_INVALID_TRANSITION');

      const view = recruiterView(
        await http()
          .get(`/api/v1/recruiter/applications/${application.id}`)
          .set(bearer(hrA))
          .expect(200),
      );
      expect(view).toMatchObject({ status: 'WITHDRAWN', allowedTransitions: [] });
    });

    it('rút đơn của người khác: 404', async () => {
      const { application } = await appliedCandidate();
      const other = await appliedCandidate();
      await http()
        .post(`/api/v1/me/applications/${application.id}/withdraw`)
        .set(bearer(other.session))
        .expect(404);
    });
  });
});
