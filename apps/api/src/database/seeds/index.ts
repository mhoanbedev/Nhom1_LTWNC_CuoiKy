/**
 * `make seed` / `npm run seed`: danh mục (kỹ năng, ngành, tỉnh/thành) và tài khoản admin.
 * Chạy lại bao nhiêu lần cũng được. Dùng chung data-source với TypeORM CLI, nên trên production
 * chạy từ máy với DATABASE_DIRECT_URL trỏ vào Neon.
 */
import { emailSchema, passwordSchema } from '@ltwnc/shared';
import { z } from 'zod';
import { PasswordService } from '../../modules/auth/password.service';
import { RefreshToken } from '../../modules/auth/entities/refresh-token.entity';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';
import { seedAdmin } from './admin.seed';
import { seedCatalogs } from './catalogs.seed';

const seedEnvSchema = z.object({
  SEED_ADMIN_EMAIL: emailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
});

function readSeedEnv(): z.infer<typeof seedEnvSchema> {
  const result = seedEnvSchema.safeParse(process.env);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Biến môi trường cho seed không hợp lệ:\n${lines.join('\n')}`);
}

async function main(): Promise<void> {
  const env = readSeedEnv();
  await dataSource.initialize();
  try {
    const { catalogs, admin } = await dataSource.transaction(async (manager) => ({
      catalogs: await seedCatalogs(manager),
      admin: await seedAdmin(
        {
          users: manager.getRepository(User),
          refreshTokens: manager.getRepository(RefreshToken),
          passwords: new PasswordService(),
        },
        { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD },
      ),
    }));
    console.log(
      `Seed xong: ${catalogs.skills} kỹ năng, ${catalogs.industries} ngành, ${catalogs.locations} tỉnh/thành.`,
    );
    const adminLabel = { created: 'đã tạo', updated: 'đã cập nhật', unchanged: 'không đổi' }[admin];
    console.log(`Admin ${env.SEED_ADMIN_EMAIL}: ${adminLabel}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
