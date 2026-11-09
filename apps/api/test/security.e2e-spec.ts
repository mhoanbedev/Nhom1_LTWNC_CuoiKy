import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import type { ApiError } from '@ltwnc/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { buildThrottlerOptions } from '../src/common/rate-limit/rate-limit';

/** Giới hạn thấp chỉ cho file này; các file e2e khác dùng mức rất cao trong setup-env. */
const AUTH_PER_MINUTE = 5;
const LOGIN_PER_EMAIL = 3;

describe('Bảo mật: giới hạn tần suất, helmet, CORS (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getOptionsToken())
      .useValue(
        buildThrottlerOptions({
          authPerMinute: AUTH_PER_MINUTE,
          loginPerEmail: LOGIN_PER_EMAIL,
        }),
      )
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (email: string) =>
    http().post('/api/v1/auth/login').send({ email, password: 'sai123456' });

  describe('giới hạn tần suất', () => {
    it('đăng nhập sai quá số lần cho một email thì 429, email khác vẫn đăng nhập được', async () => {
      const email = `e2e-rl-${runId}@test.local`;
      for (let i = 0; i < LOGIN_PER_EMAIL; i += 1) await login(email).expect(401);

      // Viết hoa và có khoảng trắng vẫn tính là cùng email.
      const blocked = await login(` ${email.toUpperCase()} `).expect(429);
      expect((blocked.body as ApiError).code).toBe('TOO_MANY_REQUESTS');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      await login(`e2e-rl-khac-${runId}@test.local`).expect(401);
    });

    it('route auth công khai bị giới hạn theo IP', async () => {
      for (let i = 0; i < AUTH_PER_MINUTE; i += 1) {
        await http()
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'x'.repeat(64) })
          .expect(401);
      }
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'x'.repeat(64) })
        .expect(429);
    });

    it('route không gắn giới hạn (danh mục, health) không bị 429', async () => {
      for (let i = 0; i < AUTH_PER_MINUTE * 2; i += 1) {
        await http().get('/api/v1/health').expect(200);
      }
    });
  });

  describe('helmet', () => {
    it('API có header bảo mật và CSP', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toEqual(expect.any(String));
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('trang Swagger tắt CSP để giao diện chạy được', async () => {
      const res = await http().get('/api/docs').redirects(1).expect(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS', () => {
    it('cho phép FRONTEND_URL', async () => {
      const res = await http()
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,authorization');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('không cho domain lạ', async () => {
      const res = await http()
        .get('/api/v1/health')
        .set('Origin', 'https://trang-la.example.com')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
