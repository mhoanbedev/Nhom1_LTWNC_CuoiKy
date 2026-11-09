import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

interface OpenApiDoc {
  paths: Record<string, unknown>;
  components?: { securitySchemes?: Record<string, unknown> };
}

describe('Health và Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health trả ok khi kết nối được database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ data: { status: 'ok', database: 'up' } });
  });

  it('Swagger UI mở ở /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('openapi.json có endpoint health và Bearer auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs/openapi.json').expect(200);
    const doc = res.body as OpenApiDoc;
    expect(doc.paths).toHaveProperty('/api/v1/health');
    expect(doc.components?.securitySchemes).toHaveProperty('bearer');
  });
});
