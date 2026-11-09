import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  ApiError,
  AuthResponse,
  Paginated,
  RecruiterJob,
  RecruiterJobListItem,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';

describe('Tin tuyển nháp của nhà tuyển dụng (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skillIds: { nodejs: string; react: string; english: string };
  /** Nhà tuyển dụng có công ty đã duyệt, dùng chung cho các test. */
  let recruiter: AuthResponse;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await seedCatalogs(dataSource.manager);
    const rows = await dataSource.query<{ slug: string; id: string }[]>(
      `SELECT slug, id FROM skills WHERE slug IN ('nodejs', 'react', 'english')`,
    );
    const id = (slug: string) => rows.find((row) => row.slug === slug)?.id ?? '';
    skillIds = { nodejs: id('nodejs'), react: id('react'), english: id('english') };
    recruiter = await newRecruiter({ approved: true });
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-job-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function newRecruiter({ approved }: { approved: boolean }): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-job-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'Chị HR',
        company: { translations: { vi: { name: `Công ty Tin ${runId} ${counter}` } } },
      })
      .expect(201);
    const session = (res.body as { data: AuthResponse }).data;
    if (approved) {
      await dataSource.query(`UPDATE companies SET status = 'APPROVED' WHERE id = $1`, [
        session.user.companyId,
      ]);
    }
    return session;
  }

  const createJob = (body: object, session = recruiter) =>
    http().post('/api/v1/recruiter/jobs').set(bearer(session)).send(body);

  const jobOf = (res: request.Response) => (res.body as { data: RecruiterJob }).data;
  const errorOf = (res: request.Response) => res.body as ApiError;

  describe('tạo tin', () => {
    it('công ty chưa được duyệt trả 403 COMPANY_NOT_APPROVED', async () => {
      const pending = await newRecruiter({ approved: false });
      const res = await createJob({ translations: { vi: { title: 'Thực tập Java' } } }, pending);
      expect(res.status).toBe(403);
      expect(errorOf(res).code).toBe('COMPANY_NOT_APPROVED');
    });

    it('tối thiểu: tin DRAFT, shortId 6 ký tự, slug không dấu kèm shortId', async () => {
      const job = jobOf(
        await createJob({ translations: { vi: { title: 'Thực tập Backend NodeJS' } } }).expect(201),
      );
      expect(job).toMatchObject({
        status: 'DRAFT',
        isHidden: false,
        workMode: 'ONSITE',
        isPaid: false,
        currency: 'VND',
        quantity: 1,
        expiresAt: null,
        publishedAt: null,
        skills: [],
        translations: { en: null },
      });
      expect(job.shortId).toMatch(/^[a-z0-9]{6}$/);
      expect(job.translations.vi.slug).toBe(`thuc-tap-backend-nodejs-${job.shortId}`);
    });

    it('đầy đủ: lương, kỹ năng (bắt buộc lên trước), bản en có slug riêng cùng shortId', async () => {
      const job = jobOf(
        await createJob({
          workMode: 'HYBRID',
          isPaid: true,
          salaryMin: 3_000_000,
          salaryMax: 5_000_000,
          quantity: 3,
          expiresAt: '2030-01-31T17:00:00.000Z',
          skills: [{ skillId: skillIds.english, isRequired: false }, { skillId: skillIds.nodejs }],
          translations: {
            vi: { title: 'Thực tập Fullstack', description: '## Mô tả\n- Làm API' },
            en: { title: 'Fullstack Intern' },
          },
        }).expect(201),
      );
      expect(job).toMatchObject({
        workMode: 'HYBRID',
        salaryMin: 3_000_000,
        salaryMax: 5_000_000,
        quantity: 3,
        expiresAt: '2030-01-31T17:00:00.000Z',
      });
      expect(job.skills).toEqual([
        { skillId: skillIds.nodejs, isRequired: true },
        { skillId: skillIds.english, isRequired: false },
      ]);
      expect(job.translations.en?.slug).toBe(`fullstack-intern-${job.shortId}`);
    });

    it('lương min lớn hơn max: 400 kèm lỗi ở salaryMax đã dịch', async () => {
      const res = await createJob({
        isPaid: true,
        salaryMin: 9,
        salaryMax: 1,
        translations: { vi: { title: 'Thực tập lương ngược' } },
      }).expect(400);
      expect(errorOf(res).details).toEqual([
        { field: 'salaryMax', message: 'Lương tối thiểu không được lớn hơn lương tối đa' },
      ]);
    });

    it('kỹ năng không tồn tại trả 400 INVALID_REFERENCE', async () => {
      const res = await createJob({
        skills: [{ skillId: '00000000-0000-4000-8000-000000000000' }],
        translations: { vi: { title: 'Thực tập kỹ năng lạ' } },
      }).expect(400);
      expect(errorOf(res).code).toBe('INVALID_REFERENCE');
    });
  });

  describe('sửa, xem, xóa', () => {
    it('đổi tiêu đề giữ slug; tắt isPaid xóa lương; skills gửi lên là thay cả danh sách', async () => {
      const created = jobOf(
        await createJob({
          isPaid: true,
          salaryMin: 1_000_000,
          skills: [{ skillId: skillIds.nodejs }],
          translations: { vi: { title: 'Thực tập Tiêu đề cũ' }, en: { title: 'Old title intern' } },
        }).expect(201),
      );
      const patch = (body: object) =>
        http().patch(`/api/v1/recruiter/jobs/${created.id}`).set(bearer(recruiter)).send(body);

      const renamed = jobOf(
        await patch({ translations: { vi: { title: 'Thực tập Tiêu đề mới' } } }).expect(200),
      );
      expect(renamed.translations.vi).toMatchObject({
        title: 'Thực tập Tiêu đề mới',
        slug: created.translations.vi.slug,
      });
      expect(renamed.translations.en).toBeNull();

      const unpaid = jobOf(await patch({ isPaid: false }).expect(200));
      expect(unpaid).toMatchObject({ isPaid: false, salaryMin: null, salaryMax: null });

      const reskilled = jobOf(
        await patch({ skills: [{ skillId: skillIds.react, isRequired: false }] }).expect(200),
      );
      expect(reskilled.skills).toEqual([{ skillId: skillIds.react, isRequired: false }]);

      await patch({}).expect(400);
    });

    it('danh sách: phân trang, lọc trạng thái, tìm không dấu', async () => {
      await createJob({ translations: { vi: { title: `Thực tập Đặc Biệt ${runId}` } } }).expect(
        201,
      );
      const res = await http()
        .get(`/api/v1/recruiter/jobs?status=DRAFT&q=dac biet ${runId}`)
        .set(bearer(recruiter))
        .expect(200);
      const body = res.body as Paginated<RecruiterJobListItem>;
      expect(body.meta.total).toBe(1);
      expect(body.data[0]).toMatchObject({
        status: 'DRAFT',
        title: `Thực tập Đặc Biệt ${runId}`,
        hasEnglish: false,
      });
    });

    it('tin của công ty khác trả 404 cho cả xem, sửa, xóa', async () => {
      const job = jobOf(
        await createJob({ translations: { vi: { title: 'Thực tập riêng tư' } } }).expect(201),
      );
      const other = await newRecruiter({ approved: true });
      const url = `/api/v1/recruiter/jobs/${job.id}`;
      await http().get(url).set(bearer(other)).expect(404);
      await http().patch(url).set(bearer(other)).send({ quantity: 2 }).expect(404);
      await http().delete(url).set(bearer(other)).expect(404);
    });

    it('xóa được tin nháp; tin đã đăng thì 400 JOB_INVALID_TRANSITION', async () => {
      const draft = jobOf(
        await createJob({ translations: { vi: { title: 'Thực tập sẽ xóa' } } }).expect(201),
      );
      const url = (id: string) => `/api/v1/recruiter/jobs/${id}`;
      await http().delete(url(draft.id)).set(bearer(recruiter)).expect(204);
      await http().get(url(draft.id)).set(bearer(recruiter)).expect(404);

      const published = jobOf(
        await createJob({ translations: { vi: { title: 'Thực tập đã đăng' } } }).expect(201),
      );
      await dataSource.query(`UPDATE jobs SET status = 'PUBLISHED' WHERE id = $1`, [published.id]);
      const res = await http().delete(url(published.id)).set(bearer(recruiter)).expect(400);
      expect(errorOf(res).code).toBe('JOB_INVALID_TRANSITION');
    });

    it('ứng viên gọi API tin của nhà tuyển dụng trả 403', async () => {
      const res = await http()
        .post('/api/v1/auth/register/candidate')
        .send({ email: `e2e-job-${runId}-uv@test.local`, password: 'abc12345', name: 'Ứng Viên' })
        .expect(201);
      const candidate = (res.body as { data: AuthResponse }).data;
      await http().get('/api/v1/recruiter/jobs').set(bearer(candidate)).expect(403);
    });
  });
});
