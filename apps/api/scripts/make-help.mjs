// In danh sách lệnh make từ các dòng `target: ## mô tả` trong Makefile.
// Dùng: node scripts/make-help.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const makefile = join(dirname(fileURLToPath(import.meta.url)), '..', 'Makefile');
const rows = [];

for (const line of readFileSync(makefile, 'utf8').split(/\r?\n/)) {
  const section = /^##@\s*(.+)$/.exec(line);
  if (section) {
    rows.push({ section: section[1] });
    continue;
  }
  const target = /^([a-zA-Z0-9_-]+):.*?##\s*(.+)$/.exec(line);
  if (target) rows.push({ name: target[1], description: target[2] });
}

const width = Math.max(...rows.filter((r) => r.name).map((r) => r.name.length)) + 2;
console.log('Cách dùng: make <lệnh>\n');
for (const row of rows) {
  if (row.section) console.log(`\n${row.section}`);
  else console.log(`  ${row.name.padEnd(width)}${row.description}`);
}
