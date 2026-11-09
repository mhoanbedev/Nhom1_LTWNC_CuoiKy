import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  ApiError,
  AuthResponse,
  AuthUser,
  Paginated,
  PublicJobDetail,
  RecruiterJob,
  SavedJobItem,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { CloudinaryService } from '../src/infrastructure/cloudinary/cloudinary.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

class FakeCloudinary {
  uploads = 0;
  deleted: string[] = [];
  uploadImage(_buffer: Buffer, options: { folder: string }) {
    this.uploads += 1;
    return Promise.resolve({
      url: `https://cdn.test/${options.folder}/${this.uploads}.png`,
      publicId: `${options.folder}/${this.uploads}`,
    });
  }
  deleteImage(publicId: string) {
    this.deleted.push(publicId);
    return Promise.resolve();
  }
}

describe('Tin đã lưu, isSaved, avatar (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const cloudinary = new FakeCloudinary();
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let recruiter: AuthResponse;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CloudinaryService)
      .useValue(cloudinary)
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
        email: `e2e-saved-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'HR',
        company: { translations: { vi: { name: `Công ty Lưu Tin ${runId}` } } },
      })
      .expect(201);
    recruiter = (res.body as { data: AuthResponse }).data;
    await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
      recruiter.user.companyId,
    ]);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-saved-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function newCandidate(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-saved-${runId}-${counter}@test.local`, password: 'abc12345', name: 'An' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  async function createJob(publish: boolean): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(recruiter))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: { vi: { title: `Thực tập lưu tin ${runId}` } },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    if (!publish) return job;
    const published = await http()
      .post(`/api/v1/recruiter/jobs/${job.id}/publish`)
      .set(bearer(recruiter))
      .expect(200);
    return (published.body as { data: RecruiterJob }).data;
  }

  const save = (session: AuthResponse, jobId: string) =>
    http().put(`/api/v1/me/saved-jobs/${jobId}`).set(bearer(session));
  const unsave = (session: AuthResponse, jobId: string) =>
    http().delete(`/api/v1/me/saved-jobs/${jobId}`).set(bearer(session));
  const listSaved = async (session: AuthResponse) =>
    (await http().get('/api/v1/me/saved-jobs').set(bearer(session)).expect(200))
      .body as Paginated<SavedJobItem>;
  const detail = async (job: RecruiterJob, token?: string) => {
    const req = http().get(`/api/v1/jobs/${job.translations.vi.slug}`);
    const res = await (token ? req.set({ Authorization: `Bearer ${token}` }) : req).expect(200);
    return (res.body as { data: PublicJobDetail }).data;
  };

  describe('lưu tin', () => {
    it('lưu, lưu lại (idempotent), xem danh sách, bỏ lưu (idempotent)', async () => {
      const candidate = await newCandidate();
      const job = await createJob(true);
      await save(candidate, job.id).expect(204);
      await save(candidate, job.id).expect(204);

      const page = await listSaved(candidate);
      expect(page.meta.total).toBe(1);
      expect(page.data[0]).toMatchObject({
        id: job.id,
        title: `Thực tập lưu tin ${runId}`,
        isAcceptingApplications: true,
      });
      expect(page.data[0]?.savedAt).toEqual(expect.any(String));

      await unsave(candidate, job.id).expect(204);
      await unsave(candidate, job.id).expect(204);
      expect((await listSaved(candidate)).meta.total).toBe(0);
    });

    it('tin nháp hay không tồn tại thì không lưu được (404)', async () => {
      const candidate = await newCandidate();
      const draft = await createJob(false);
      await save(candidate, draft.id).expect(404);
      await save(candidate, '00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('tin đã đóng vẫn trong danh sách (không nhận đơn); tin bị ẩn thì biến mất', async () => {
      const candidate = await newCandidate();
      const closed = await createJob(true);
      const hidden = await createJob(true);
      await save(candidate, closed.id).expect(204);
      await save(candidate, hidden.id).expect(204);
      await http()
        .post(`/api/v1/recruiter/jobs/${closed.id}/close`)
        .set(bearer(recruiter))
        .expect(200);
      await dataSource.query(`UPDATE jobs SET is_hidden = true WHERE id = $1`, [hidden.id]);

      const page = await listSaved(candidate);
      expect(page.data.map((item) => [item.id, item.isAcceptingApplications])).toEqual([
        [closed.id, false],
      ]);
    });

    it('chỉ ứng viên lưu được: nhà tuyển dụng 403', async () => {
      const job = await createJob(true);
      await save(recruiter, job.id).expect(403);
    });
  });

  describe('isSaved ở chi tiết tin', () => {
    it('ứng viên có token: có isSaved đúng trạng thái', async () => {
      const candidate = await newCandidate();
      const job = await createJob(true);
      expect((await detail(job, candidate.accessToken)).isSaved).toBe(false);
      await save(candidate, job.id).expect(204);
      expect((await detail(job, candidate.accessToken)).isSaved).toBe(true);
    });

    it('khách, token sai hay hết hạn, nhà tuyển dụng: vẫn 200, không có isSaved', async () => {
      const job = await createJob(true);
      expect(await detail(job)).not.toHaveProperty('isSaved');
      expect(await detail(job, 'token-sai.khong.hop-le')).not.toHaveProperty('isSaved');
      expect(await detail(job, recruiter.accessToken)).not.toHaveProperty('isSaved');
    });
  });

  describe('avatar', () => {
    const uploadAvatar = (session: AuthResponse, file: Buffer, filename: string, type: string) =>
      http()
        .post('/api/v1/auth/me/avatar')
        .set(bearer(session))
        .attach('file', file, { filename, contentType: type });

    it('đổi avatar: lưu URL, lần sau xóa ảnh cũ; /auth/me thấy URL mới', async () => {
      const candidate = await newCandidate();
      const first = await uploadAvatar(candidate, PNG, 'a.png', 'image/png').expect(200);
      const firstUrl = (first.body as { data: { avatarUrl: string } }).data.avatarUrl;
      expect(firstUrl).toMatch(/^https:\/\/cdn\.test\/avatars\/\d+\.png$/);

      const deletedBefore = cloudinary.deleted.length;
      const second = await uploadAvatar(candidate, PNG, 'b.png', 'image/png').expect(200);
      const secondUrl = (second.body as { data: { avatarUrl: string } }).data.avatarUrl;
      expect(cloudinary.deleted.length).toBe(deletedBefore + 1);

      const me = await http().get('/api/v1/auth/me').set(bearer(candidate)).expect(200);
      expect((me.body as { data: AuthUser }).data.avatarUrl).toBe(secondUrl);
    });

    it('nhà tuyển dụng cũng đổi được avatar; file không phải ảnh trả 400', async () => {
      await uploadAvatar(recruiter, PNG, 'hr.png', 'image/png').expect(200);
      const res = await uploadAvatar(
        recruiter,
        Buffer.from('%PDF-1.4'),
        'x.png',
        'image/png',
      ).expect(400);
      expect((res.body as ApiError).code).toBe('FILE_INVALID_TYPE');
    });
  });
});
