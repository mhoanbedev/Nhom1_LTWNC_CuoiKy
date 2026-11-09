import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ErrorCode, type ApiError, type AuthResponse } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AppException } from '../src/common/exceptions/app.exception';
import {
  GoogleIdTokenVerifier,
  type GoogleIdentity,
} from '../src/modules/auth/google/google-id-token.verifier';

/**
 * Không tạo được id_token Google thật trong test, nên thay lớp verify bằng bản giả:
 * idToken gửi lên là khóa tra trong `identities`. Phần còn lại (DB, phiên) chạy thật.
 */
describe('/auth/oauth/google (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = Date.now();
  const identities = new Map<string, GoogleIdentity>();
  const email = (name: string) => `e2e-google-${runId}-${name}@test.local`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue({
        verify: (idToken: string) => {
          const identity = identities.get(idToken);
          if (!identity) throw new AppException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
          return Promise.resolve(identity);
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-google-${runId}%'`);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows = await dataSource.query<{ count: string }[]>(sql, params);
    return Number(rows[0]?.count ?? 0);
  }

  function googleToken(name: string, overrides: Partial<GoogleIdentity> = {}): string {
    const token = `token-${runId}-${name}`;
    identities.set(token, {
      sub: `sub-${runId}-${name}`,
      email: email(name),
      emailVerified: true,
      name: 'Người Dùng Google',
      picture: null,
      ...overrides,
    });
    return token;
  }

  const loginGoogle = (idToken: string, lang = 'vi') =>
    http().post(`/api/v1/auth/oauth/google?lang=${lang}`).send({ idToken });

  it('lần đầu tạo ứng viên mới, lần sau đăng nhập lại đúng user đó', async () => {
    const token = googleToken('moi');
    const first = (await loginGoogle(token, 'en').expect(200)).body as { data: AuthResponse };
    expect(first.data.user).toMatchObject({
      email: email('moi'),
      role: 'CANDIDATE',
      preferredLocale: 'en',
      name: 'Người Dùng Google',
    });
    expect(first.data.refreshToken).toEqual(expect.any(String));

    const again = (await loginGoogle(token).expect(200)).body as { data: AuthResponse };
    expect(again.data.user.id).toBe(first.data.user.id);

    // Tài khoản tạo từ Google chưa có mật khẩu nên không đăng nhập bằng mật khẩu được.
    await http()
      .post('/api/v1/auth/login')
      .send({ email: email('moi'), password: 'abc12345' })
      .expect(401);
  });

  it('email đã xác minh trùng tài khoản đăng ký bằng form thì liên kết vào tài khoản đó', async () => {
    const registered = (
      (
        await http()
          .post('/api/v1/auth/register/candidate')
          .send({ email: email('lienket'), password: 'abc12345', name: 'Đã Đăng Ký' })
          .expect(201)
      ).body as { data: AuthResponse }
    ).data;

    const res = (await loginGoogle(googleToken('lienket')).expect(200)).body as {
      data: AuthResponse;
    };
    expect(res.data.user).toMatchObject({ id: registered.user.id, name: 'Đã Đăng Ký' });

    expect(
      await countRows(`SELECT count(*) FROM accounts WHERE user_id = $1 AND provider = 'google'`, [
        registered.user.id,
      ]),
    ).toBe(1);
    // Mật khẩu cũ vẫn dùng được song song với Google.
    await http()
      .post('/api/v1/auth/login')
      .send({ email: email('lienket'), password: 'abc12345' })
      .expect(200);
  });

  it('email Google chưa xác minh trả 400 và không tạo user', async () => {
    const res = await loginGoogle(googleToken('chuaxacminh', { emailVerified: false })).expect(400);
    expect((res.body as ApiError).code).toBe('AUTH_GOOGLE_EMAIL_UNVERIFIED');
    expect(
      await countRows(`SELECT count(*) FROM users WHERE email = $1`, [email('chuaxacminh')]),
    ).toBe(0);
  });

  it('tài khoản bị khóa trả 403', async () => {
    const token = googleToken('khoa');
    await loginGoogle(token).expect(200);
    await dataSource.query(`UPDATE users SET status = 'LOCKED' WHERE email = $1`, [email('khoa')]);
    const res = await loginGoogle(token).expect(403);
    expect((res.body as ApiError).code).toBe('AUTH_ACCOUNT_LOCKED');
  });

  it('id_token không hợp lệ trả 401, thiếu idToken trả 400', async () => {
    const res = await loginGoogle('khong-hop-le').expect(401);
    expect((res.body as ApiError).code).toBe('AUTH_GOOGLE_TOKEN_INVALID');
    await http().post('/api/v1/auth/oauth/google').send({}).expect(400);
  });
});
