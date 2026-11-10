import './openapi-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { API_PREFIX, buildOpenApiDocument } from '../app.setup';

/** File OpenAPI commit trong repo (apps/api/openapi.json), cho frontend đọc và sinh kiểu. */
export const OPENAPI_FILE = 'openapi.json';

/**
 * Tài liệu OpenAPI dạng chuỗi JSON (thụt 2, xuống dòng cuối file), giống trang `/api/docs`.
 * Dựng app ở chế độ preview: không khởi tạo provider nên không kết nối DB hay dịch vụ ngoài.
 */
export async function renderOpenApi(): Promise<string> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.setGlobalPrefix(API_PREFIX);
  try {
    return `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`;
  } finally {
    await app.close();
  }
}
