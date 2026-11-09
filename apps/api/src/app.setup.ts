import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

/**
 * Cấu hình dùng chung cho main.ts và test e2e, để test chạy đúng như app thật.
 * Pipe, filter, interceptor global khai trong AppModule (APP_*), không khai ở đây.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  setupSwagger(app);
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Cổng tuyển dụng thực tập – API')
    .setDescription(
      [
        'REST API cho Đề 5. Response thành công: `{ data }` hoặc `{ data, meta }` khi phân trang.',
        'Lỗi theo format chung `ApiError`; `message` dịch theo `?lang=vi|en` hoặc header `Accept-Language`.',
      ].join('\n\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // cleanupOpenApiDoc: hoàn thiện schema sinh từ DTO Zod (nestjs-zod).
  SwaggerModule.setup(SWAGGER_PATH, app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: `${SWAGGER_PATH}/openapi.json`,
    swaggerOptions: { persistAuthorization: true },
  });
}
