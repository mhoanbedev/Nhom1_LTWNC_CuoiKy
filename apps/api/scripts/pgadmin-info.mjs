// In URL và tài khoản pgAdmin, đọc từ .env (hoặc giá trị mặc định của docker-compose.yml).
// Dùng: node scripts/pgadmin-info.mjs
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

console.log(`pgAdmin:   http://localhost:${get('PGADMIN_PORT', '5050')}`);
console.log(`Đăng nhập: ${get('PGADMIN_DEFAULT_EMAIL', 'admin@example.com')} / ${get('PGADMIN_DEFAULT_PASSWORD', 'admin')}`);
console.log('Server "LTWNC (Docker)" đã khai sẵn: host postgres, cổng 5432 (trong mạng Docker).');
console.log(`Mật khẩu database khi pgAdmin hỏi: ${get('POSTGRES_PASSWORD', 'ltwnc')}`);
console.log(`Từ máy (DBeaver, psql...): localhost:${get('POSTGRES_PORT', '5434')}`);
