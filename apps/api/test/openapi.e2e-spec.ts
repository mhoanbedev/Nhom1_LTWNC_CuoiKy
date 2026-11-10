import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp, SWAGGER_PATH } from '../src/app.setup';
import { OPENAPI_FILE, renderOpenApi } from '../src/openapi/openapi-document';

const committedFile = join(__dirname, '..', OPENAPI_FILE);

describe('openapi.json cho frontend (e2e)', () => {
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

  it('file trong repo khớp code hiện tại (đổi API thì chạy make openapi rồi commit)', async () => {
    const committed = readFileSync(committedFile, 'utf8').replace(/\r\n/g, '\n');
    const current = await renderOpenApi();
    if (committed !== current) {
      throw new Error(
        'apps/api/openapi.json đã cũ so với code. Chạy `make openapi` (hoặc `npm run openapi` trong apps/api) rồi commit file.',
      );
    }
  });

  it('trang Swagger của app thật trả đúng tài liệu trong file', async () => {
    const res = await request(app.getHttpServer()).get(`/${SWAGGER_PATH}/openapi.json`).expect(200);
    expect(res.body).toEqual(JSON.parse(readFileSync(committedFile, 'utf8')));
  });
});
