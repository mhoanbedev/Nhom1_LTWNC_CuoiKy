/**
 * `make cloudinary-check`: thử key Cloudinary trong .env bằng cách upload một ảnh công khai và
 * một file PDF riêng tư vào folder `dev-check/`, rồi in link. Mở link PDF mà lỗi 401/403 thì
 * chưa bật Settings → Security → "Allow delivery of PDF and ZIP files".
 */
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateEnv } from '../../config/env.schema';
import { CloudinaryService } from './cloudinary.service';

// PNG 1x1 màu đỏ.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

// PDF một trang, chữ "LTWNC Cloudinary check".
const PDF = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R',
    '/Resources << /Font << /F1 5 0 R >> >> >> endobj',
    '4 0 obj << /Length 52 >> stream',
    'BT /F1 14 Tf 20 45 Td (LTWNC Cloudinary check) Tj ET',
    'endstream endobj',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n'),
);

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = validateEnv(process.env);
  const service = new CloudinaryService({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  });

  const image = await service.uploadImage(PNG, { folder: 'dev-check', maxSize: 64 });
  console.log(`Ảnh công khai: ${image.url}`);

  const pdf = await service.uploadPrivateFile(PDF, {
    folder: 'dev-check',
    fileName: `${randomUUID()}.pdf`,
  });
  const download = service.privateDownloadUrl(pdf.publicId, 300);
  console.log(`PDF riêng tư (link sống 5 phút): ${download.url}`);
  console.log(
    'Xem file trong Cloudinary: Media Library → folder dev-check (xóa tay khi không cần).',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
