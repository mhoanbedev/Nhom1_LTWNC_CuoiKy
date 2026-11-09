import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role, UserStatus, type ApiError, type AuthResponse } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import type { RequestUser } from '../src/common/types/request-user';

/** Route cần đăng nhập, chỉ dùng trong test để kiểm guard. */
@Controller('__auth-test')
class GuardTestController {
  @Get('me')
  me(@CurrentUser() user: RequestUser): RequestUser {
    return user;
  }

  @Get('admin-only')
  @Roles(Role.ADMIN)
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  // Email riêng mỗi lần chạy để test không đụng dữ liệu dev; dọn ở afterAll.
  const runId = Date.now();
  const email = `e2e-${runId}@test.local`;
  const password = 'abc12345';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardTestController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('đăng ký ứng viên trả 201 kèm token, email chuẩn hoá chữ thường', async () => {
    const res = await http()
      .post('/api/v1/auth/register/candidate?lang=en')
      .send({ email: email.toUpperCase(), password, name: 'Nguyễn An' })
      .expect(201);
    const body = (res.body as { data: AuthResponse }).data;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email, role: 'CANDIDATE', preferredLocale: 'en' });
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('đăng ký trùng email trả 409 AUTH_EMAIL_TAKEN', async () => {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email, password, name: 'Trùng' })
      .expect(409);
    expect((res.body as ApiError).code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('mật khẩu yếu trả 400 kèm câu báo đã dịch', async () => {
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-${runId}-weak@test.local`, password: '12345678', name: 'Yếu' })
      .expect(400);
    expect((res.body as ApiError).details).toEqual([
      { field: 'password', message: 'Mật khẩu phải có cả chữ và số' },
    ]);
  });

  it('đăng nhập đúng trả 200 và token dùng được cho route cần đăng nhập', async () => {
    const login = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
    const { accessToken } = (login.body as { data: AuthResponse }).data;

    const me = await http()
      .get('/api/v1/__auth-test/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ data: { email, role: 'CANDIDATE' } });
  });

  it('sai mật khẩu và email không tồn tại cùng trả 401 AUTH_INVALID_CREDENTIALS', async () => {
    const wrong = await http().post('/api/v1/auth/login').send({ email, password: 'sai12345' });
    const unknown = await http()
      .post('/api/v1/auth/login')
      .send({ email: `e2e-${runId}-none@test.local`, password });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect((res.body as ApiError).code).toBe('AUTH_INVALID_CREDENTIALS');
    }
  });

  it('không có token trả 401 AUTH_TOKEN_INVALID', async () => {
    const res = await http().get('/api/v1/__auth-test/me').expect(401);
    expect((res.body as ApiError).code).toBe('AUTH_TOKEN_INVALID');
  });

  it('token giả trả 401', async () => {
    await http()
      .get('/api/v1/__auth-test/me')
      .set('Authorization', 'Bearer khong.phai.jwt')
      .expect(401);
  });

  it('ứng viên gọi route chỉ dành cho admin trả 403 FORBIDDEN', async () => {
    const login = await http().post('/api/v1/auth/login').send({ email, password });
    const { accessToken } = (login.body as { data: AuthResponse }).data;
    const res = await http()
      .get('/api/v1/__auth-test/admin-only')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect((res.body as ApiError).code).toBe('FORBIDDEN');
  });

  it('tài khoản bị khóa: token còn hạn vẫn bị chặn 403, đăng nhập cũng 403', async () => {
    const login = await http().post('/api/v1/auth/login').send({ email, password });
    const { accessToken } = (login.body as { data: AuthResponse }).data;
    await dataSource.query('UPDATE users SET status = $1 WHERE email = $2', [
      UserStatus.LOCKED,
      email,
    ]);

    const me = await http()
      .get('/api/v1/__auth-test/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect((me.body as ApiError).code).toBe('AUTH_ACCOUNT_LOCKED');

    const relogin = await http().post('/api/v1/auth/login').send({ email, password }).expect(403);
    expect((relogin.body as ApiError).code).toBe('AUTH_ACCOUNT_LOCKED');
  });
});
