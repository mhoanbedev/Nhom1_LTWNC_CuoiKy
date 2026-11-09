import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode, type ApiError, type Paginated } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { AppException } from '../src/common/exceptions/app.exception';

class CreateThingDto extends createZodDto(
  z.object({ name: z.string().min(2), age: z.number().int().positive() }),
) {}

/** Controller chỉ dùng trong test, để kiểm tra các lớp dùng chung qua HTTP thật. */
@Controller('__test')
class TestController {
  @Get('ok')
  ok(): { hello: string } {
    return { hello: 'world' };
  }

  @Get('page')
  page(): unknown {
    return { data: [1, 2], meta: { page: 1, limit: 2, total: 2, totalPages: 1 } };
  }

  @Get('app-error')
  appError(): never {
    throw new AppException(ErrorCode.COMPANY_NOT_APPROVED);
  }

  @Get('crash')
  crash(): never {
    throw new Error('lỗi nội bộ không được lộ');
  }

  @Post('things')
  create(@Body() body: CreateThingDto): CreateThingDto {
    return body;
  }
}

describe('Lớp dùng chung (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    }).compile();
    moduleRef.useLogger(false);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('bọc response thành công thành { data } và trả x-request-id', async () => {
    const res = await http().get('/api/v1/__test/ok').expect(200);
    expect(res.body).toEqual({ data: { hello: 'world' } });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('giữ nguyên response phân trang', async () => {
    const res = await http().get('/api/v1/__test/page').expect(200);
    expect((res.body as Paginated<number>).meta).toEqual({
      page: 1,
      limit: 2,
      total: 2,
      totalPages: 1,
    });
  });

  it('AppException trả đúng status, mã lỗi và format chung', async () => {
    const res = await http()
      .get('/api/v1/__test/app-error')
      .set('x-request-id', 'test-req-1')
      .expect(403);
    const body = res.body as ApiError;
    expect(body).toMatchObject({
      statusCode: 403,
      code: 'COMPANY_NOT_APPROVED',
      details: null,
      path: '/api/v1/__test/app-error',
      requestId: 'test-req-1',
    });
    expect(body.message).toBeTruthy();
  });

  it('body sai trả 400 VALIDATION_FAILED kèm details từng trường', async () => {
    const res = await http().post('/api/v1/__test/things').send({ name: 'a', age: -1 }).expect(400);
    const body = res.body as ApiError;
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details?.map((d) => d.field).sort()).toEqual(['age', 'name']);
  });

  it('body đúng đi qua validate', async () => {
    const res = await http()
      .post('/api/v1/__test/things')
      .send({ name: 'An', age: 20 })
      .expect(201);
    expect(res.body).toEqual({ data: { name: 'An', age: 20 } });
  });

  it('route không tồn tại trả 404 NOT_FOUND đúng format', async () => {
    const res = await http().get('/api/v1/khong-ton-tai').expect(404);
    expect((res.body as ApiError).code).toBe('NOT_FOUND');
  });

  it('lỗi không lường trước trả 500 và không lộ chi tiết', async () => {
    const res = await http().get('/api/v1/__test/crash').expect(500);
    expect((res.body as ApiError).code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('không được lộ');
  });
});
