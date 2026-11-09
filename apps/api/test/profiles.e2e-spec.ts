import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse, CandidateProfile } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';

describe('Hồ sơ ứng viên 4 bước (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;
  let skill: { nodejs: string; react: string; english: string };
  let hanoi: string;

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
    skill = { nodejs: id('nodejs'), react: id('react'), english: id('english') };
    const locations = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM locations WHERE code = 'ha-noi'`,
    );
    hanoi = locations[0]?.id ?? '';
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-prof-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const profileOf = (res: request.Response) => (res.body as { data: CandidateProfile }).data;

  async function newCandidate(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-prof-${runId}-${counter}@test.local`, password: 'abc12345', name: 'An' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const put = (session: AuthResponse, step: string, body: object, query = '') =>
    http().put(`/api/v1/me/profile/${step}${query}`).set(bearer(session)).send(body);

  it('chưa lưu gì: hồ sơ rỗng, 0%, chưa nộp đơn được', async () => {
    const candidate = await newCandidate();
    const profile = profileOf(
      await http().get('/api/v1/me/profile').set(bearer(candidate)).expect(200),
    );
    expect(profile).toMatchObject({
      basic: null,
      education: [],
      completion: { percent: 0, canApply: false },
      updatedAt: null,
    });
  });

  it('đi đủ 4 bước: lưu đúng dữ liệu, tiến độ tăng dần, xong 3 bước bắt buộc thì canApply', async () => {
    const candidate = await newCandidate();

    const basic = profileOf(
      await put(candidate, 'basic', {
        headline: 'Sinh viên năm 3 CNTT',
        phone: '091 234 5678',
        dateOfBirth: '2004-05-20',
        locationId: hanoi,
        links: [{ label: 'GitHub', url: 'https://github.com/an' }],
      }).expect(200),
    );
    expect(basic.basic).toMatchObject({ phone: '0912345678', dateOfBirth: '2004-05-20' });
    expect(basic.completion.percent).toBe(25);

    const education = profileOf(
      await put(candidate, 'education', {
        items: [
          { school: 'THPT Chu Văn An', startDate: '2019-09', endDate: '2022-06' },
          { school: 'ĐH Bách Khoa', major: 'CNTT', startDate: '2022-09', endDate: null, gpa: 3.45 },
        ],
      }).expect(200),
    );
    // Mới nhất lên trước; GPA về số, tháng về YYYY-MM.
    expect(education.education.map((row) => [row.school, row.startDate, row.gpa])).toEqual([
      ['ĐH Bách Khoa', '2022-09', 3.45],
      ['THPT Chu Văn An', '2019-09', null],
    ]);

    const skills = profileOf(
      await put(
        candidate,
        'skills',
        {
          items: [
            { skillId: skill.english, level: 3 },
            { skillId: skill.nodejs, level: 4 },
          ],
        },
        '?lang=en',
      ).expect(200),
    );
    expect(skills.skills).toEqual([
      { skillId: skill.nodejs, slug: 'nodejs', name: 'Node.js', level: 4 },
      { skillId: skill.english, slug: 'english', name: 'English', level: 3 },
    ]);
    expect(skills.completion).toMatchObject({ percent: 75, canApply: true, missingRequired: [] });

    const projects = profileOf(await put(candidate, 'projects', { items: [] }).expect(200));
    expect(projects.completion.percent).toBe(100);
  });

  it('lưu lại một bước là thay toàn bộ, không nhân đôi bước đã xong', async () => {
    const candidate = await newCandidate();
    await put(candidate, 'skills', { items: [{ skillId: skill.nodejs, level: 2 }] }).expect(200);
    const again = profileOf(
      await put(candidate, 'skills', { items: [{ skillId: skill.react, level: 5 }] }).expect(200),
    );
    expect(again.skills.map((row) => row.slug)).toEqual(['react']);
    expect(again.completion.steps.filter((step) => step.completed)).toHaveLength(1);
  });

  it('dữ liệu sai: 400 kèm lỗi đúng trường, không đánh dấu bước', async () => {
    const candidate = await newCandidate();
    const res = await put(candidate, 'education', {
      items: [{ school: 'ĐH Bách Khoa', startDate: '2022-09', endDate: '2021-01' }],
    }).expect(400);
    expect((res.body as ApiError).details).toEqual([
      {
        field: 'items.0.endDate',
        message: 'Thời gian kết thúc không được trước thời gian bắt đầu',
      },
    ]);

    const unknownSkill = await put(candidate, 'skills', {
      items: [{ skillId: '00000000-0000-4000-8000-000000000000', level: 3 }],
    }).expect(400);
    expect((unknownSkill.body as ApiError).code).toBe('INVALID_REFERENCE');

    const profile = profileOf(
      await http().get('/api/v1/me/profile').set(bearer(candidate)).expect(200),
    );
    expect(profile.completion.percent).toBe(0);
  });

  it('lưu cùng lúc hai lần không tạo hai hồ sơ', async () => {
    const candidate = await newCandidate();
    await Promise.all([
      put(candidate, 'basic', { headline: 'Lần một' }),
      put(candidate, 'basic', { headline: 'Lần hai' }),
    ]);
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM candidate_profiles WHERE user_id = $1`,
      [candidate.user.id],
    );
    expect(rows[0]?.count).toBe('1');
  });

  it('chỉ ứng viên dùng được: nhà tuyển dụng 403, không token 401', async () => {
    await http().get('/api/v1/me/profile').expect(401);
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: `e2e-prof-${runId}-${counter}@test.local`,
        password: 'abc12345',
        name: 'HR',
        company: { translations: { vi: { name: `Công ty Hồ Sơ ${runId}` } } },
      })
      .expect(201);
    const recruiter = (res.body as { data: AuthResponse }).data;
    await http().get('/api/v1/me/profile').set(bearer(recruiter)).expect(403);
  });
});
