/**
 * `make close-expired-jobs` / `npm run jobs:close-expired`: đóng ngay các tin đã hết hạn, đúng việc
 * cron làm lúc 0h05 (JobExpiryService.closeExpired), để demo hay thử mà không phải đợi nửa đêm.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { JobExpiryService } from './job-expiry.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const closed = await app.get(JobExpiryService).closeExpired();
    console.log(
      closed.length === 0
        ? 'Không có tin nào hết hạn cần đóng.'
        : `Đã đóng ${closed.length} tin hết hạn.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
