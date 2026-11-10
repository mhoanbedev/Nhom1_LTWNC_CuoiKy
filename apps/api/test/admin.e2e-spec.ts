import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type {
  AdminJob,
  AdminUser,
  ApiError,
  AuthResponse,
  NotificationItem,
  Paginated,
  PublicJobListItem,
  RecruiterJob,
} from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedCatalogs } from '../src/database/seeds/catalogs.seed';
import { adminSession, type AdminSession } from './utils/admin-session';

describe('Admin: ẩn tin, khóa tài khoản (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: AdminSession;
  const runId = Date.now();
  let counter = 0;
  let skillId: string;
  let hr: AuthResponse;
  let hrEmail: string;
  let job: RecruiterJob;

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

    hrEmail = nextEmail();
    const res = await http()
      .post('/api/v1/auth/register/recruiter')
      .send({
        email: hrEmail,
        password: 'abc12345',
        name: 'HR Admin e2e',
        company: {
          translations: {
            vi: { name: `Công ty Quản Trị ${runId}` },
            en: { name: `Admin Co ${runId}` },
          },
        },
      })
      .expect(201);
    hr = (res.body as { data: AuthResponse }).data;
    await http()
      .patch(`/api/v1/admin/companies/${hr.user.companyId}/approve`)
      .set(asAdmin())
      .expect(200);
    const created = await http()
      .post('/api/v1/recruiter/jobs')
      .set(bearer(hr))
      .send({
        expiresAt: '2031-01-31T17:00:00.000Z',
        skills: [{ skillId }],
        translations: {
          vi: { title: `Thực tập quản trị ${runId}` },
          en: { title: `Admin intern ${runId}` },
        },
      })
      .expect(201);
    job = (created.body as { data: RecruiterJob }).data;
    await http().post(`/api/v1/recruiter/jobs/${job.id}/publish`).set(bearer(hr)).expect(200);
    await http().post('/api/v1/me/notifications/read-all').set(bearer(hr)).expect(200);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-admin-${runId}%'`);
    await admin.cleanup();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (session: AuthResponse) => ({ Authorization: `Bearer ${session.accessToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const nextEmail = () => `e2e-admin-${runId}-${(counter += 1)}@test.local`;
  const publicDetail = () => http().get(`/api/v1/jobs/${job.translations.vi.slug}`);
  const searchIds = async () =>
    (
      (
        await http()
          .get(`/api/v1/jobs?q=${encodeURIComponent(`quản trị ${runId}`)}`)
          .expect(200)
      ).body as Paginated<PublicJobListItem>
    ).data.map((item) => item.id);
  const hrNotifications = async () =>
    (
      (await http().get('/api/v1/me/notifications?unread=true').set(bearer(hr)).expect(200))
        .body as Paginated<NotificationItem>
    ).data;

  async function newCandidate(): Promise<{ email: string; session: AuthResponse }> {
    const email = nextEmail();
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email, password: 'abc12345', name: 'Ứng viên bị khóa' })
      .expect(201);
    return { email, session: (res.body as { data: AuthResponse }).data };
  }

  describe('ẩn tin', () => {
    it('ẩn: tin biến khỏi web, nhà tuyển dụng nhận JOB_HIDDEN đã dịch', async () => {
      await publicDetail().expect(200);
      expect(await searchIds()).toContain(job.id);

      const res = await http()
        .patch(`/api/v1/admin/jobs/${job.id}/hide`)
        .set(asAdmin())
        .send({ reason: 'Nội dung sai sự thật' })
        .expect(200);
      expect((res.body as { data: AdminJob }).data).toMatchObject({
        id: job.id,
        status: 'PUBLISHED',
        isHidden: true,
        hiddenReason: 'Nội dung sai sự thật',
        title: `Thực tập quản trị ${runId}`,
        company: { id: hr.user.companyId, name: `Công ty Quản Trị ${runId}` },
      });

      await publicDetail().expect(404);
      expect(await searchIds()).not.toContain(job.id);
      const { session } = await newCandidate();
      await http()
        .post(`/api/v1/jobs/${job.id}/applications`)
        .set(bearer(session))
        .send({ cvFileId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);

      const notifications = await hrNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: 'JOB_HIDDEN',
        title: 'Tin tuyển dụng bị ẩn',
        body: `Tin "Thực tập quản trị ${runId}" đã bị quản trị viên ẩn. Lý do: Nội dung sai sự thật`,
      });
    });

    it('ẩn lại tin đang ẩn: 200, giữ lý do cũ, không báo lại', async () => {
      const res = await http()
        .patch(`/api/v1/admin/jobs/${job.id}/hide`)
        .set(asAdmin())
        .send({ reason: 'Lý do khác hẳn' })
        .expect(200);
      expect((res.body as { data: AdminJob }).data.hiddenReason).toBe('Nội dung sai sự thật');
      expect(await hrNotifications()).toHaveLength(1);
    });

    it('nhà tuyển dụng vẫn thấy tin của mình kèm lý do bị ẩn', async () => {
      const res = await http().get(`/api/v1/recruiter/jobs/${job.id}`).set(bearer(hr)).expect(200);
      expect((res.body as { data: RecruiterJob }).data).toMatchObject({
        isHidden: true,
        hiddenReason: 'Nội dung sai sự thật',
      });
    });

    it('danh sách admin lọc được theo hidden, status và tiêu đề gõ không dấu', async () => {
      const list = async (query: string) =>
        (
          (await http().get(`/api/v1/admin/jobs?${query}`).set(asAdmin()).expect(200))
            .body as Paginated<AdminJob>
        ).data.map((item) => item.id);
      expect(await list(`hidden=true&q=thuc tap quan tri ${runId}`)).toEqual([job.id]);
      expect(await list(`hidden=false&q=thuc tap quan tri ${runId}`)).toEqual([]);
      expect(await list(`status=DRAFT&q=thuc tap quan tri ${runId}`)).toEqual([]);
    });

    it('bỏ ẩn: tin về lại trạng thái cũ và hiện lại trên web', async () => {
      const res = await http()
        .patch(`/api/v1/admin/jobs/${job.id}/unhide`)
        .set(asAdmin())
        .expect(200);
      expect((res.body as { data: AdminJob }).data).toMatchObject({
        status: 'PUBLISHED',
        isHidden: false,
        hiddenReason: null,
      });
      await publicDetail().expect(200);
      expect(await searchIds()).toContain(job.id);
      // Bỏ ẩn lần nữa vẫn 200.
      await http().patch(`/api/v1/admin/jobs/${job.id}/unhide`).set(asAdmin()).expect(200);
    });

    it('lý do quá ngắn 400; tin không tồn tại 404', async () => {
      await http()
        .patch(`/api/v1/admin/jobs/${job.id}/hide`)
        .set(asAdmin())
        .send({ reason: 'abc' })
        .expect(400);
      await http()
        .patch('/api/v1/admin/jobs/00000000-0000-4000-8000-000000000000/hide')
        .set(asAdmin())
        .send({ reason: 'Nội dung sai sự thật' })
        .expect(404);
    });
  });

  describe('khóa tài khoản', () => {
    it('khóa: token cũ 403, refresh bị từ chối, đăng nhập 403; mở khóa thì đăng nhập lại được', async () => {
      const { email, session } = await newCandidate();
      await http().get('/api/v1/auth/me').set(bearer(session)).expect(200);

      const locked = await http()
        .patch(`/api/v1/admin/users/${session.user.id}/lock`)
        .set(asAdmin())
        .expect(200);
      expect((locked.body as { data: AdminUser }).data).toMatchObject({
        id: session.user.id,
        email,
        role: 'CANDIDATE',
        status: 'LOCKED',
        company: null,
      });

      const me = await http().get('/api/v1/auth/me').set(bearer(session)).expect(403);
      expect((me.body as ApiError).code).toBe('AUTH_ACCOUNT_LOCKED');
      const refresh = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBeGreaterThanOrEqual(400);
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'abc12345' })
        .expect(403);
      expect((login.body as ApiError).code).toBe('AUTH_ACCOUNT_LOCKED');
      // Khóa lần nữa vẫn 200.
      await http().patch(`/api/v1/admin/users/${session.user.id}/lock`).set(asAdmin()).expect(200);

      const unlocked = await http()
        .patch(`/api/v1/admin/users/${session.user.id}/unlock`)
        .set(asAdmin())
        .expect(200);
      expect((unlocked.body as { data: AdminUser }).data.status).toBe('ACTIVE');
      await http().post('/api/v1/auth/login').send({ email, password: 'abc12345' }).expect(200);
    });

    it('khóa nhà tuyển dụng không ẩn tin của công ty', async () => {
      await http().patch(`/api/v1/admin/users/${hr.user.id}/lock`).set(asAdmin()).expect(200);
      await publicDetail().expect(200);
      await http().patch(`/api/v1/admin/users/${hr.user.id}/unlock`).set(asAdmin()).expect(200);
    });

    it('admin không tự khóa được mình; user không tồn tại 404', async () => {
      const res = await http()
        .patch(`/api/v1/admin/users/${admin.adminId}/lock`)
        .set(asAdmin())
        .expect(400);
      expect((res.body as ApiError).code).toBe('CANNOT_LOCK_SELF');
      await http()
        .patch('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/lock')
        .set(asAdmin())
        .expect(404);
    });

    it('danh sách tài khoản lọc theo vai trò và email, kèm công ty của nhà tuyển dụng', async () => {
      const res = await http()
        .get(`/api/v1/admin/users?role=RECRUITER&q=${encodeURIComponent(hrEmail)}`)
        .set(asAdmin())
        .expect(200);
      const page = res.body as Paginated<AdminUser>;
      expect(page.meta.total).toBe(1);
      expect(page.data[0]).toMatchObject({
        id: hr.user.id,
        role: 'RECRUITER',
        status: 'ACTIVE',
        company: { id: hr.user.companyId, name: `Công ty Quản Trị ${runId}` },
      });
    });
  });

  it('không phải admin gọi /admin/* thì 403', async () => {
    await http().get('/api/v1/admin/jobs').set(bearer(hr)).expect(403);
    await http().get('/api/v1/admin/users').set(bearer(hr)).expect(403);
    await http().patch(`/api/v1/admin/users/${hr.user.id}/lock`).set(bearer(hr)).expect(403);
  });
});
