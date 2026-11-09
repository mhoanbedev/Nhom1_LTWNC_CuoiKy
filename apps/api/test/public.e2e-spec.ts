import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AuthResponse,
  Paginated,
  PublicCompanyDetail,
  PublicCompanyListItem,
  PublicJobDetail,
  PublicJobListItem,
  RecruiterJob,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';

describe('API công khai: tin và công ty (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skill: { nodejs: string; react: string };
  let hanoi: string;
  /** Công ty đã duyệt, có bản vi và en. */
  let recruiter: AuthResponse;
  let companySlugs: { vi: string; en: string };
  /** Công ty đã duyệt, chỉ có bản vi. */
  let viOnlyCompanySlug: string;
  /** Công ty chưa duyệt (có tin PUBLISHED trong DB nhưng không được hiện). */
  let pendingCompanySlug: string;
  const jobs: Record<
    'backend' | 'frontend' | 'draft' | 'closed' | 'hidden' | 'expired',
    RecruiterJob
  > = {} as never;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await seedCatalogs(dataSource.manager);
    const skills = await dataSource.query<{ slug: string; id: string }[]>(
      `SELECT slug, id FROM skills WHERE slug IN ('nodejs', 'react')`,
    );
    const id = (slug: string) => skills.find((row) => row.slug === slug)?.id ?? '';
    skill = { nodejs: id('nodejs'), react: id('react') };
    const locations = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM locations WHERE code = 'ha-noi'`,
    );
    hanoi = locations[0]?.id ?? '';

    recruiter = await newRecruiter({
      vi: { name: `Công ty Công Khai ${runId}`, description: '**Giới thiệu** công ty' },
      en: { name: `Public Company ${runId}` },
    });
    await approve(recruiter);
    const slugs = await dataSource.query<{ locale: string; slug: string }[]>(
      `SELECT locale, slug FROM company_translations WHERE company_id = $1`,
      [recruiter.user.companyId],
    );
    companySlugs = {
      vi: slugs.find((row) => row.locale === 'vi')?.slug ?? '',
      en: slugs.find((row) => row.locale === 'en')?.slug ?? '',
    };

    jobs.backend = await publishedJob({
      locationId: hanoi,
      isPaid: true,
      salaryMin: 3_000_000,
      salaryMax: 5_000_000,
      expiresAt: '2031-12-31T17:00:00.000Z',
      skills: [{ skillId: skill.nodejs }],
      translations: {
        vi: { title: `Thực tập Backend NodeJS ${runId}`, description: '## Mô tả\n- Làm API' },
        en: { title: `Backend NodeJS Intern ${runId}` },
      },
    });
    jobs.frontend = await publishedJob({
      workMode: 'HYBRID',
      expiresAt: '2030-06-30T17:00:00.000Z',
      skills: [{ skillId: skill.react }],
      translations: { vi: { title: `Thực tập Frontend React ${runId}` } },
    });
    jobs.draft = await createJob({ translations: { vi: { title: `Thực tập Nháp ${runId}` } } });
    jobs.closed = await publishedJob(readyBody(`Thực tập Đã Đóng ${runId}`));
    await http()
      .post(`/api/v1/recruiter/jobs/${jobs.closed.id}/close`)
      .set(bearer(recruiter))
      .expect(200);
    jobs.hidden = await publishedJob(readyBody(`Thực tập Bị Ẩn ${runId}`));
    await dataSource.query(`UPDATE jobs SET is_hidden = true WHERE id = $1`, [jobs.hidden.id]);
    jobs.expired = await publishedJob(readyBody(`Thực tập Hết Hạn ${runId}`));
    await dataSource.query(`UPDATE jobs SET expires_at = now() - interval '1 day' WHERE id = $1`, [
      jobs.expired.id,
    ]);

    const viOnly = await newRecruiter({ vi: { name: `Công ty Chỉ Tiếng Việt ${runId}` } });
    await approve(viOnly);
    viOnlyCompanySlug = await viSlugOf(viOnly);

    const pending = await newRecruiter({ vi: { name: `Công ty Chờ Duyệt ${runId}` } });
    pendingCompanySlug = await viSlugOf(pending);
    // Tin PUBLISHED của công ty chưa duyệt (dựng thẳng trong DB) vẫn không được hiện.
    await approve(pending);
    await publishedJob(readyBody(`Thực tập Công Ty Chờ ${runId}`), pending);
    await dataSource.query(`UPDATE companies SET status = 'PENDING' WHERE id = $1`, [
      pending.user.companyId,
    ]);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-pub-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function newRecruiter(translations: object): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-pub-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'Chị HR',
        company: { website: 'https://congkhai.example.com', translations },
      })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  async function approve(session: AuthResponse) {
    await dataSource.query(
      `UPDATE companies SET status = 'APPROVED', approved_at = now() WHERE id = $1`,
      [session.user.companyId],
    );
  }

  async function viSlugOf(session: AuthResponse): Promise<string> {
    const rows = await dataSource.query<{ slug: string }[]>(
      `SELECT slug FROM company_translations WHERE company_id = $1 AND locale = 'vi'`,
      [session.user.companyId],
    );
    return rows[0]?.slug ?? '';
  }

  const readyBody = (title: string) => ({
    expiresAt: '2031-01-31T17:00:00.000Z',
    skills: [{ skillId: skill.nodejs }],
    translations: { vi: { title } },
  });

  async function createJob(body: object, session = recruiter): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(session))
      .send(body)
      .expect(201);
    return (res.body as { data: RecruiterJob }).data;
  }

  async function publishedJob(body: object, session = recruiter): Promise<RecruiterJob> {
    const job = await createJob(body, session);
    const res = await http()
      .post(`/api/v1/recruiter/jobs/${job.id}/publish`)
      .set(bearer(session))
      .expect(200);
    return (res.body as { data: RecruiterJob }).data;
  }

  const listJobs = async (query: string) =>
    (await http().get(`/api/v1/jobs?${query}`).expect(200)).body as Paginated<PublicJobListItem>;
  const titles = (page: Paginated<PublicJobListItem>) => page.data.map((job) => job.title);

  describe('GET /jobs', () => {
    it('chỉ tin công khai: bỏ nháp, đã đóng, bị ẩn, hết hạn, công ty chưa duyệt; mới đăng lên trước', async () => {
      const page = await listJobs(`q=${runId}&sort=newest`);
      expect(titles(page)).toEqual([
        `Thực tập Frontend React ${runId}`,
        `Thực tập Backend NodeJS ${runId}`,
      ]);
      expect(page.meta.total).toBe(2);
    });

    it('?lang=en: tin có bản en trả bản en, tin chỉ có bản vi vẫn hiện với locale vi', async () => {
      const page = await listJobs(`q=${runId}&lang=en&sort=newest`);
      expect(page.data.map((job) => [job.locale, job.title])).toEqual([
        ['vi', `Thực tập Frontend React ${runId}`],
        ['en', `Backend NodeJS Intern ${runId}`],
      ]);
      expect(page.data[1]).toMatchObject({
        slug: `backend-nodejs-intern-${runId}-${jobs.backend.shortId}`,
        company: { locale: 'en', slug: companySlugs.en },
        location: { name: 'Hanoi' },
        skills: [{ slug: 'nodejs', name: 'Node.js', isRequired: true }],
      });
    });

    it('lọc kỹ năng (mọi cách viết), hình thức làm việc, có lương', async () => {
      expect(titles(await listJobs(`q=${runId}&skills=${skill.nodejs}`))).toEqual([
        `Thực tập Backend NodeJS ${runId}`,
      ]);
      expect(titles(await listJobs(`q=${runId}&skills[]=${skill.react}`))).toEqual([
        `Thực tập Frontend React ${runId}`,
      ]);
      expect((await listJobs(`q=${runId}&skills=${skill.nodejs},${skill.react}`)).meta.total).toBe(
        2,
      );
      expect(titles(await listJobs(`q=${runId}&workMode=HYBRID`))).toEqual([
        `Thực tập Frontend React ${runId}`,
      ]);
      expect(titles(await listJobs(`q=${runId}&isPaid=true`))).toEqual([
        `Thực tập Backend NodeJS ${runId}`,
      ]);
    });

    it('sắp xếp theo hạn nộp và theo độ liên quan (gõ không dấu)', async () => {
      expect(titles(await listJobs(`q=${runId}&sort=deadline`))[0]).toBe(
        `Thực tập Frontend React ${runId}`,
      );
      expect(titles(await listJobs(`q=thuc tap backend nodejs ${runId}`))[0]).toBe(
        `Thực tập Backend NodeJS ${runId}`,
      );
    });

    it('query sai kiểu trả 400', async () => {
      await http().get('/api/v1/jobs?workMode=ABC').expect(400);
      await http().get('/api/v1/jobs?skills=khong-phai-uuid').expect(400);
    });
  });

  describe('GET /jobs/:slug', () => {
    const detail = async (slug: string, query = '', status = 200) =>
      (await http().get(`/api/v1/jobs/${slug}${query}`).expect(status)).body as {
        data: PublicJobDetail;
      };

    it('tin công khai: indexable, nhận đơn, có HTML đã render, alternates đủ hai ngôn ngữ', async () => {
      const { data } = await detail(jobs.backend.translations.vi.slug);
      expect(data).toMatchObject({
        locale: 'vi',
        canonicalSlug: jobs.backend.translations.vi.slug,
        isAcceptingApplications: true,
        seo: { indexable: true },
        descriptionHtml: '<h2>Mô tả</h2>\n<ul>\n<li>Làm API</li>\n</ul>',
        company: { website: 'https://congkhai.example.com' },
      });
      expect(data.alternates.map((alt) => alt.locale)).toEqual(['en', 'vi']);
    });

    it('slug lệch nhưng đúng shortId vẫn tìm ra, trả canonicalSlug để redirect', async () => {
      const { data } = await detail(`ten-cu-${jobs.backend.shortId}`);
      expect(data.canonicalSlug).toBe(jobs.backend.translations.vi.slug);
    });

    it('không có bản theo lang thì 404, không lấy bản vi thay', async () => {
      await detail(jobs.frontend.translations.vi.slug, '?lang=en', 404);
      const { data } = await detail(jobs.backend.translations.vi.slug, '?lang=en');
      expect(data.title).toBe(`Backend NodeJS Intern ${runId}`);
    });

    it('đã đóng hoặc hết hạn: 200 nhưng noindex, không nhận đơn', async () => {
      for (const job of [jobs.closed, jobs.expired]) {
        const { data } = await detail(job.translations.vi.slug);
        expect(data).toMatchObject({ isAcceptingApplications: false, seo: { indexable: false } });
      }
    });

    it('nháp, bị ẩn, slug không có shortId hợp lệ: 404', async () => {
      await detail(jobs.draft.translations.vi.slug, '', 404);
      await detail(jobs.hidden.translations.vi.slug, '', 404);
      await detail('khong-ton-tai', '', 404);
    });
  });

  describe('công ty', () => {
    it('GET /companies: chỉ công ty đã duyệt, đếm tin đang mở', async () => {
      const page = (await http().get(`/api/v1/companies?q=${runId}`).expect(200))
        .body as Paginated<PublicCompanyListItem>;
      const names = page.data.map((company) => company.name);
      expect(names).toContain(`Công ty Công Khai ${runId}`);
      expect(names).not.toContain(`Công ty Chờ Duyệt ${runId}`);
      const main = page.data.find((company) => company.slug === companySlugs.vi);
      expect(main?.openJobCount).toBe(2);
    });

    it('GET /companies/:slug: tìm bằng slug mọi ngôn ngữ, trả đúng bản theo lang', async () => {
      const vi = (await http().get(`/api/v1/companies/${companySlugs.vi}`).expect(200)).body as {
        data: PublicCompanyDetail;
      };
      expect(vi.data).toMatchObject({
        locale: 'vi',
        canonicalSlug: companySlugs.vi,
        descriptionHtml: '<p><strong>Giới thiệu</strong> công ty</p>',
        openJobCount: 2,
      });
      const en = (await http().get(`/api/v1/companies/${companySlugs.vi}?lang=en`).expect(200))
        .body as { data: PublicCompanyDetail };
      expect(en.data).toMatchObject({ locale: 'en', canonicalSlug: companySlugs.en });
    });

    it('công ty chưa duyệt, hoặc không có bản theo lang: 404', async () => {
      await http().get(`/api/v1/companies/${pendingCompanySlug}`).expect(404);
      await http().get(`/api/v1/companies/${viOnlyCompanySlug}?lang=en`).expect(404);
      await http().get(`/api/v1/companies/${pendingCompanySlug}/jobs`).expect(404);
    });

    it('GET /companies/:slug/jobs: tin công khai của công ty', async () => {
      const page = (await http().get(`/api/v1/companies/${companySlugs.en}/jobs`).expect(200))
        .body as Paginated<PublicJobListItem>;
      expect(titles(page)).toEqual([
        `Thực tập Frontend React ${runId}`,
        `Thực tập Backend NodeJS ${runId}`,
      ]);
    });
  });
});
