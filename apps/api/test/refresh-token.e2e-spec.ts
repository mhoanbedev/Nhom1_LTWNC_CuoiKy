import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { ApiError, AuthResponse } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Refresh token xoay vòng (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  const password = 'abc12345';
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-rt-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Mỗi test một user riêng để các phiên không ảnh hưởng nhau. */
  async function newSession(): Promise<AuthResponse> {
    counter += 1;
    const res = await http()
      .post('/api/v1/auth/register/candidate')
      .send({ email: `e2e-rt-${runId}-${counter}@test.local`, password, name: 'Refresh' })
      .expect(201);
    return (res.body as { data: AuthResponse }).data;
  }

  const refresh = (refreshToken: string) =>
    http().post('/api/v1/auth/refresh').send({ refreshToken });

  /** Giả lập token đã bị xoay từ 1 phút trước (ngoài khoảng ân hạn 30 giây). */
  const backdateRevocation = (refreshToken: string) =>
    dataSource.query(
      `UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute'
       WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
      [refreshToken],
    );

  it('đăng ký trả kèm refresh token và mốc hết hạn khoảng 7 ngày', async () => {
    const session = await newSession();
    expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{86}$/);
    const days = (new Date(session.refreshTokenExpiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('refresh trả cặp token mới, token mới tiếp tục dùng được', async () => {
    const session = await newSession();
    const first = await refresh(session.refreshToken).expect(200);
    const rotated = (first.body as { data: AuthResponse }).data;
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(rotated.user.id).toBe(session.user.id);

    await refresh(rotated.refreshToken).expect(200);
  });

  it('DB chỉ lưu hash, không lưu token gốc', async () => {
    const session = await newSession();
    const rows: unknown[] = await dataSource.query(
      'SELECT 1 FROM refresh_tokens WHERE token_hash = $1',
      [session.refreshToken],
    );
    expect(rows).toHaveLength(0);
  });

  it('hai request refresh cùng lúc bằng một token đều thành công (khoảng ân hạn)', async () => {
    const session = await newSession();
    const [a, b] = await Promise.all([
      refresh(session.refreshToken),
      refresh(session.refreshToken),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
  });

  it('dùng lại token đã xoay ngoài khoảng ân hạn: 401 AUTH_REFRESH_REUSED và thu hồi cả phiên', async () => {
    const session = await newSession();
    const rotated = (
      (await refresh(session.refreshToken).expect(200)).body as { data: AuthResponse }
    ).data;
    await backdateRevocation(session.refreshToken);

    const reused = await refresh(session.refreshToken).expect(401);
    expect((reused.body as ApiError).code).toBe('AUTH_REFRESH_REUSED');

    // Token mới nhất của phiên cũng bị thu hồi: kẻ trộm và người dùng đều phải đăng nhập lại.
    await refresh(rotated.refreshToken).expect(401);
  });

  it('token không tồn tại trả 401 AUTH_REFRESH_INVALID', async () => {
    const res = await refresh('x'.repeat(86)).expect(401);
    expect((res.body as ApiError).code).toBe('AUTH_REFRESH_INVALID');
  });

  it('logout thu hồi phiên hiện tại; phiên khác của cùng user vẫn dùng được', async () => {
    const session = await newSession();
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: session.user.email, password })
      .expect(200);
    const otherDevice = (login.body as { data: AuthResponse }).data;

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    await refresh(session.refreshToken).expect(401);
    await refresh(otherDevice.refreshToken).expect(200);
  });

  it('logout-all thu hồi mọi phiên của user', async () => {
    const session = await newSession();
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: session.user.email, password });
    const otherDevice = (login.body as { data: AuthResponse }).data;

    await http()
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);

    await refresh(session.refreshToken).expect(401);
    await refresh(otherDevice.refreshToken).expect(401);
  });

  it('logout cần đăng nhập', async () => {
    await http()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'x'.repeat(86) })
      .expect(401);
  });
});
