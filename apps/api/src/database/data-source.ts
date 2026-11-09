/**
 * DataSource cho TypeORM CLI (migration:generate, migration:run...). App không import file này.
 * CLI chạy ngoài NestJS nên tự nạp .env; trên Render env có sẵn trong process.
 */
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

if (existsSync('.env')) process.loadEnvFile('.env');

// Production (Neon): migration chạy bằng chuỗi direct, app chạy bằng chuỗi pooled.
const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error('Thiếu DATABASE_URL (hoặc DATABASE_DIRECT_URL) để chạy TypeORM CLI.');
}

export default new DataSource(buildDataSourceOptions(url));
