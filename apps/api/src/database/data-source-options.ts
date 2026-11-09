import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Cấu hình TypeORM dùng chung cho app (DatabaseModule) và TypeORM CLI (data-source.ts),
 * để migration sinh ra luôn khớp với cách app đọc schema.
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // Tên bảng, cột snake_case: createdAt -> created_at, JobTranslation -> job_translation.
    namingStrategy: new SnakeNamingStrategy(),
    // Mọi thay đổi schema đi qua migration; không bao giờ để TypeORM tự sửa bảng.
    synchronize: false,
    migrationsRun: false,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    logging: ['error', 'warn', 'migration'],
  };
}
