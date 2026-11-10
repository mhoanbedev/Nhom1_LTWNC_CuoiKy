// Hỏi xác nhận trước thao tác phá hủy dữ liệu. Trả lời y thì exit 0 để make chạy tiếp; còn lại
// exit 1 để make dừng. Dùng: node scripts/confirm.mjs <mã câu hỏi>
// Câu hỏi đặt trong file này chứ không truyền qua tham số: make trên Windows làm hỏng chữ có dấu.
import { createInterface } from 'node:readline/promises';

const QUESTIONS = {
  'db-reset': 'Xóa toàn bộ dữ liệu Postgres dev (cả dữ liệu tự tạo) rồi dựng lại?',
};

const key = process.argv[2] ?? '';
const question = QUESTIONS[key];
if (!question) {
  console.error(`Không có câu hỏi xác nhận cho "${key}". Thêm vào QUESTIONS trong scripts/confirm.mjs.`);
  process.exit(1);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const answer = await prompt.question(`${question} (y/N) `);
prompt.close();

if (answer.trim().toLowerCase() !== 'y') {
  console.log('Đã hủy, không đổi gì.');
  process.exit(1);
}
