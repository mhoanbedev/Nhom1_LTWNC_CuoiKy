import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { appConfig } from './config/app.config';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

/**
 * Cấu hình dùng chung cho main.ts và test e2e, để test chạy đúng như app thật.
 * Pipe, filter, interceptor global khai trong AppModule (APP_*), không khai ở đây.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Render đặt API sau một lớp proxy: tin đúng 1 hop để req.ip là IP thật của client
  // (giới hạn tần suất, IP ghi vào phiên đăng nhập). Máy dev không có proxy nên không bật,
  // tránh client tự gửi X-Forwarded-For giả.
  if (config.isProduction) {
    const express = app.getHttpAdapter().getInstance() as {
      set(key: string, value: unknown): void;
    };
    express.set('trust proxy', 1);
  }

  useSecurityHeaders(app);
  // Chỉ frontend được gọi từ trình duyệt. Xác thực bằng header Bearer, không dùng cookie.
  app.enableCors({
    // Dạng mảng: origin lạ không nhận header Access-Control-Allow-Origin nào.
    origin: [config.frontendUrl],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 86400,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  setupSwagger(app);
}

/**
 * helmet cho mọi response. Riêng trang Swagger UI tắt Content-Security-Policy vì giao diện này
 * cần script và style inline; API chỉ trả JSON nên giữ CSP mặc định.
 */
function useSecurityHeaders(app: INestApplication): void {
  const apiHeaders = helmet();
  const docsHeaders = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isDocs = req.path.startsWith(`/${SWAGGER_PATH}`);
    (isDocs ? docsHeaders : apiHeaders)(req, res, next);
  });
}

/**
 * Tài liệu OpenAPI của toàn bộ API. Dùng chung cho trang Swagger (`/api/docs`) và `make openapi`
 * (ghi ra `openapi.json`), để file trong repo và trang Swagger không thể lệch nhau.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Cổng tuyển dụng thực tập – API')
    .setDescription(
      [
        'REST API cho Đề 5. Response thành công: `{ data }` hoặc `{ data, meta }` khi phân trang.',
        'Lỗi theo format chung `ApiError`; `message` dịch theo `?lang=vi|en` hoặc header `Accept-Language`.',
        'Đăng ký, đăng nhập, refresh, Google có giới hạn tần suất; vượt thì 429 `TOO_MANY_REQUESTS` kèm header `Retry-After`.',
      ].join('\n\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  // cleanupOpenApiDoc: hoàn thiện schema sinh từ DTO Zod (nestjs-zod).
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: `${SWAGGER_PATH}/openapi.json`,
    swaggerOptions: { persistAuthorization: true },
  });
}
