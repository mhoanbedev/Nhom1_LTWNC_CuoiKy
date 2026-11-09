// In thông số kết nối PostgreSQL trong Docker để khai báo trong pgAdmin (hoặc DBeaver...) trên máy.
// Đọc từ .env, thiếu thì dùng giá trị mặc định của docker-compose.yml.
// Dùng: node scripts/db-info.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
}

const get = (key, fallback) => env[key] || fallback;

console.log('Kết nối PostgreSQL (Docker) từ pgAdmin trên máy: Register > Server > tab Connection');
console.log(`  Host:     localhost`);
console.log(`  Port:     ${get('POSTGRES_PORT', '5435')}`);
console.log(`  Database: ${get('POSTGRES_DB', 'ltwnc')}`);
console.log(`  Username: ${get('POSTGRES_USER', 'ltwnc')}`);
console.log(`  Password: ${get('POSTGRES_PASSWORD', 'ltwnc')}`);
