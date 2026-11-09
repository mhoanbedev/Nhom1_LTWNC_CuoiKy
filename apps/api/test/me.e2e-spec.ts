import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse, AuthUser } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('/auth/me và đổi mật khẩu (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-me-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function newSession(password = 'abc12345'): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-me-${runId}-${counter}@test.local`, password, name: 'Người Dùng' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('GET /auth/me trả user hiện tại', async () => {
    const session = await newSession();
    const res = await http().get('/api/v1/auth/me').set(bearer(session.accessToken)).expect(200);
    expect((res.body as { data: AuthUser }).data).toMatchObject({
      id: session.user.id,
      email: session.user.email,
      role: 'CANDIDATE',
    });
  });

  it('PATCH /auth/me đổi ngôn ngữ ưa thích và tên', async () => {
    const session = await newSession();
    const res = await http()
      .patch('/api/v1/auth/me')
      .set(bearer(session.accessToken))
      .send({ preferredLocale: 'en', name: '  Tên Mới  ' })
      .expect(200);
    expect((res.body as { data: AuthUser }).data).toMatchObject({
      preferredLocale: 'en',
      name: 'Tên Mới',
    });
  });

  it('PATCH /auth/me với body rỗng trả 400', async () => {
    const session = await newSession();
    const res = await http()
      .patch('/api/v1/auth/me?lang=en')
      .set(bearer(session.accessToken))
      .send({})
      .expect(400);
    expect((res.body as ApiError).details?.[0]?.message).toBe('Send at least one field to update');
  });

  it('đổi mật khẩu: thiết bị cũ bị đăng xuất ngay, thiết bị hiện tại nhận token mới', async () => {
    const session = await newSession('cu123456');
    const otherDevice = (
      (
        await http()
          .post('/api/v1/auth/login')
          .send({ email: session.user.email, password: 'cu123456' })
          .expect(200)
      ).body as { data: AuthResponse }
    ).data;

    // Đợi sang giây mới để mốc đổi mật khẩu chắc chắn sau thời điểm cấp token cũ.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const res = await http()
      .patch('/api/v1/auth/me/password')
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'cu123456', newPassword: 'moi123456' })
      .expect(200);
    const fresh = (res.body as { data: AuthResponse }).data;

    // Access token cũ của cả hai thiết bị hết hiệu lực ngay, không đợi 15 phút.
    await http().get('/api/v1/auth/me').set(bearer(otherDevice.accessToken)).expect(401);
    await http().get('/api/v1/auth/me').set(bearer(session.accessToken)).expect(401);
    // Refresh token cũ cũng bị thu hồi.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: otherDevice.refreshToken })
      .expect(401);
    // Token mới dùng được, đăng nhập bằng mật khẩu mới được, mật khẩu cũ thì không.
    await http().get('/api/v1/auth/me').set(bearer(fresh.accessToken)).expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: session.user.email, password: 'moi123456' })
      .expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: session.user.email, password: 'cu123456' })
      .expect(401);
  });

  it('sai mật khẩu hiện tại trả 400 AUTH_PASSWORD_INCORRECT', async () => {
    const session = await newSession();
    const res = await http()
      .patch('/api/v1/auth/me/password')
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'sai12345', newPassword: 'moi123456' })
      .expect(400);
    expect((res.body as ApiError).code).toBe('AUTH_PASSWORD_INCORRECT');
  });

  it('các route /auth/me cần đăng nhập', async () => {
    await http().get('/api/v1/auth/me').expect(401);
    await http().patch('/api/v1/auth/me').send({ name: 'X' }).expect(401);
  });
});
