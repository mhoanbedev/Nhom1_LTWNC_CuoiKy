import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { AuthResponse, RecruiterJob, SitemapEntry, StaticParam } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { adminSession, type AdminSession } from './utils/admin-session';

describe('SEO: sitemap, static-params (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let hr: AuthResponse;
  /** Có cả vi và en. */
  let bilingual: RecruiterJob;
  /** Chỉ có vi. */
  let viOnly: RecruiterJob;
  let draft: RecruiterJob;
  let hidden: RecruiterJob;
  let expired: RecruiterJob;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    bilingual = await createJob(hr, 'Song ngữ', { publish: true, english: true });
    viOnly = await createJob(hr, 'Tiếng Việt', { publish: true, english: false });
    draft = await createJob(hr, 'Nháp', { publish: false, english: true });
    hidden = await createJob(hr, 'Bị ẩn', { publish: true, english: false });
    expired = await createJob(hr, 'Hết hạn', { publish: true, english: false });
    await http()
      .patch(`/api/v1/admin/jobs/${hidden.id}/hide`)
      .set(asAdmin())
      .send({ reason: 'Nội dung sai sự thật' })
      .expect(200);
    await dataSource.query(`UPDATE jobs SET expires_at = now() - interval '1 day' WHERE id = $1`, [
      expired.id,
    ]);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-seo-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-seo-${runId}-${(counter += 1)}@test.local`;

  async function newRecruiter(label: string): Promise<AuthResponse> {
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: nextEmail(),
        password: 'abc12345',
        name: `HR SEO ${label}`,
        company: {
          translations: {
            vi: { name: `Công ty SEO ${label} ${runId}` },
            en: { name: `SEO Co ${label} ${runId}` },
          },
        },
      })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const approve = (session: AuthResponse) =>
    http()
      .patch(`/api/v1/admin/companies/${session.user.companyId}/approve`)
      .set(asAdmin())
      .expect(200);

  async function createJob(
    session: AuthResponse,
    label: string,
    options: { publish: boolean; english: boolean },
  ): Promise<RecruiterJob> {
    const res = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(session))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: {
          vi: { title: `Thực tập SEO ${label} ${runId}` },
          ...(options.english && { en: { title: `SEO intern ${label} ${runId}` } }),
        },
      })
      .expect(201);
    const job = (res.body as { data: RecruiterJob }).data;
    if (options.publish) {
      await http()
        .post(`/api/v1/recruiter/jobs/${job.id}/publish`)
        .set(bearer(session))
        .expect(200);
    }
    return job;
  }

  /** Gọi không kèm token: route công khai. */
  const sitemap = async () =>
    ((await http().get('/api/v1/seo/sitemap').expect(200)).body as { data: SitemapEntry[] }).data;
  const entry = (entries: SitemapEntry[], id: string | null) =>
    entries.find((item) => item.id === id);

  it('sitemap: tin công khai kèm đúng các bản ngôn ngữ đã có, vi đứng đầu', async () => {
    const entries = await sitemap();
    expect(entry(entries, bilingual.id)).toMatchObject({
      type: 'job',
      alternates: [
        { locale: 'vi', slug: bilingual.translations.vi.slug },
        { locale: 'en', slug: bilingual.translations.en?.slug },
      ],
    });
    expect(entry(entries, viOnly.id)?.alternates).toEqual([
      { locale: 'vi', slug: viOnly.translations.vi.slug },
    ]);
    expect(entry(entries, hr.user.companyId)).toMatchObject({
      type: 'company',
      alternates: [{ locale: 'vi' }, { locale: 'en' }],
    });
  });

  it('sitemap không có tin nháp, bị ẩn, hết hạn, công ty chờ duyệt', async () => {
    const pending = await newRecruiter('Chờ');
    const ids = (await sitemap()).map((item) => item.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(pending.user.companyId);
  });

  it('sửa bản en thì updatedAt của tin trong sitemap tăng', async () => {
    const before = entry(await sitemap(), bilingual.id)?.updatedAt ?? '';
    await http()
      .patch(`/api/v1/recruiter/jobs/${bilingual.id}`)
      .set(bearer(hr))
      .send({
        translations: {
          vi: { title: `Thực tập SEO Song ngữ ${runId}` },
          en: { title: `SEO intern Bilingual (updated) ${runId}` },
        },
      })
      .expect(200);
    const after = entry(await sitemap(), bilingual.id)?.updatedAt ?? '';
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });

  it('static-params: tin mới đăng nhất trước, mỗi bản dịch một cặp, theo limit', async () => {
    const latest = await createJob(hr, 'Mới nhất', { publish: true, english: true });
    const res = await http().get('/api/v1/seo/static-params?type=job&limit=1').expect(200);
    expect((res.body as { data: StaticParam[] }).data).toEqual([
      { locale: 'vi', slug: latest.translations.vi.slug },
      { locale: 'en', slug: latest.translations.en?.slug },
    ]);

    const many = await http().get('/api/v1/seo/static-params?type=job&limit=1000').expect(200);
    const slugs = (many.body as { data: StaticParam[] }).data.map((param) => param.slug);
    expect(slugs).toContain(viOnly.translations.vi.slug);
    expect(slugs).not.toContain(draft.translations.vi.slug);
    expect(slugs).not.toContain(expired.translations.vi.slug);
  });

  it('static-params công ty: công ty mới duyệt nhất trước', async () => {
    const other = await newRecruiter('Mới duyệt');
    await approve(other);
    const res = await http().get('/api/v1/seo/static-params?type=company&limit=1').expect(200);
    expect((res.body as { data: StaticParam[] }).data.map((param) => param.locale)).toEqual([
      'vi',
      'en',
    ]);
    expect((res.body as { data: StaticParam[] }).data[0]?.slug).toContain('cong-ty-seo-moi-duyet');
  });

  it('thu hồi duyệt công ty thì công ty và tin của nó rời sitemap', async () => {
    const other = await newRecruiter('Thu hồi');
    await approve(other);
    const job = await createJob(other, 'Thu hồi', { publish: true, english: false });
    let ids = (await sitemap()).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([job.id, other.user.companyId]));

    await http()
      .patch(`/api/v1/admin/companies/${other.user.companyId}/reject`)
      .set(asAdmin())
      .send({ reason: 'Thiếu giấy phép kinh doanh' })
      .expect(200);
    ids = (await sitemap()).map((item) => item.id);
    expect(ids).not.toContain(job.id);
    expect(ids).not.toContain(other.user.companyId);
  });

  it('static-params: thiếu hoặc sai type, limit ngoài khoảng thì 400', async () => {
    await http().get('/api/v1/seo/static-params').expect(400);
    await http().get('/api/v1/seo/static-params?type=skill').expect(400);
    await http().get('/api/v1/seo/static-params?type=job&limit=0').expect(400);
  });
});
