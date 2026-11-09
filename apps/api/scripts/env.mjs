// Tạo .env từ .env.example nếu chưa có; nếu đã có thì bổ sung biến còn thiếu, giữ nguyên giá trị cũ.
// Biến tên *_SECRET để trống trong .env.example được sinh ngẫu nhiên (chỉ dùng cho dev).
// Dùng: node scripts/env.mjs
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = join(root, '.env.example');
const envPath = join(root, '.env');

const keyOf = (line) => {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
  return match ? match[1] : null;
};

/** `JWT_ACCESS_SECRET=` (trống) -> `JWT_ACCESS_SECRET=<48 byte ngẫu nhiên>`. */
const fillSecret = (line) => {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*_SECRET)\s*=\s*$/.exec(line);
  return match ? `${match[1]}=${randomBytes(48).toString('base64url')}` : line;
};

const exampleLines = readFileSync(examplePath, 'utf8').split(/\r?\n/);

if (!existsSync(envPath)) {
  writeFileSync(envPath, exampleLines.map(fillSecret).join('\n'));
  console.log('Đã tạo .env từ .env.example.');
  process.exit(0);
}

const existingKeys = new Set(readFileSync(envPath, 'utf8').split(/\r?\n/).map(keyOf).filter(Boolean));
const missing = exampleLines.filter((line) => {
  const key = keyOf(line);
  return key !== null && !existingKeys.has(key);
});

if (missing.length === 0) {
  console.log('.env đã đủ biến.');
} else {
  const current = readFileSync(envPath, 'utf8');
  const prefix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
  appendFileSync(envPath, `${prefix}${missing.map(fillSecret).join('\n')}\n`);
  console.log(`Đã thêm ${missing.length} biến vào .env: ${missing.map(keyOf).join(', ')}`);
}
