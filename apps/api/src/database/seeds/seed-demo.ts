/**
 * `make seed-demo` / `npm run seed:demo`: xóa rồi tạo lại dữ liệu demo (tài khoản @demo.vn trừ admin,
 * công ty, tin, đơn...). Chạy sau `make seed` (cần danh mục). Hỏi xác nhận trước khi xóa; truyền
 * `--yes` để bỏ qua (make setup dùng). Upload 3 CV mẫu lên Cloudinary folder `seed/` (public_id cố
 * định, chạy lại không sinh file rác).
 */
import { Faker, base, en, vi } from '@faker-js/faker';
import { createInterface } from 'node:readline/promises';
import { validateEnv } from '../../config/env.schema';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { PasswordService } from '../../modules/auth/password.service';
import dataSource from '../data-source';
import { seedCvs } from './demo/demo-cv';
import {
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  seedDemo,
  wipeDemo,
  type DemoCv,
} from './demo/demo.seed';

/** Seed cố định: lần nào chạy cũng ra cùng một bộ dữ liệu. */
const FAKER_SEED = 2026;

async function confirm(): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(
    `Xóa mọi tài khoản @${DEMO_EMAIL_DOMAIN} (trừ admin) cùng công ty, tin, đơn của họ rồi tạo lại? (y/N) `,
  );
  prompt.close();
  return answer.trim().toLowerCase() === 'y';
}

async function uploadCvs(): Promise<DemoCv[]> {
  const env = validateEnv(process.env);
  const cloudinary = new CloudinaryService({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  });
  const uploaded: DemoCv[] = [];
  for (const cv of seedCvs()) {
    // public_id cố định, overwrite tắt: lần sau Cloudinary trả lại file đã có.
    const file = await cloudinary.uploadPrivateFile(cv.buffer, {
      folder: 'seed',
      fileName: cv.fileName,
    });
    uploaded.push({
      publicId: file.publicId,
      originalName: cv.originalName,
      size: cv.buffer.length,
    });
  }
  return uploaded;
}

async function main(): Promise<void> {
  if (!(await confirm())) {
    console.log('Đã hủy, không đổi gì.');
    return;
  }
  const cvs = await uploadCvs();
  const passwords = new PasswordService();
  const passwordHash = await passwords.hash(DEMO_PASSWORD);
  const faker = new Faker({ locale: [vi, en, base] });
  faker.seed(FAKER_SEED);

  await dataSource.initialize();
  try {
    const result = await dataSource.transaction(async (manager) => {
      await wipeDemo(manager);
      return seedDemo(manager, { faker, passwordHash, cvs, now: new Date() });
    });
    console.log(
      `Seed demo xong: ${result.companies} công ty, ${result.candidates} ứng viên, ${result.jobs} tin, ` +
        `${result.applications} đơn, ${result.notifications} thông báo, ${result.savedJobs} tin đã lưu.`,
    );
    console.log(`Mật khẩu mọi tài khoản demo: ${DEMO_PASSWORD}`);
    for (const email of Object.values(DEMO_ACCOUNTS)) console.log(`  - ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
