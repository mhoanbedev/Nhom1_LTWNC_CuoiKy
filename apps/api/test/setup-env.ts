// Env tối thiểu cho test, để test không phụ thuộc file .env trên máy (CI không có .env).
// Chỉ điền biến còn thiếu; biến đã đặt từ ngoài vẫn được giữ.
const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://ltwnc:ltwnc@localhost:5435/ltwnc',
  JWT_ACCESS_SECRET: 'test-only-secret-khong-dung-cho-production-0123456789',
  JWT_ACCESS_EXPIRES_IN: '15m',
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  // Giá trị giả: test không gọi Cloudinary thật (mock CloudinaryService).
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-secret',
  // Rất cao để các test khác không bị 429; test giới hạn tần suất tự đặt mức thấp.
  RATE_LIMIT_AUTH_PER_MINUTE: '100000',
  RATE_LIMIT_LOGIN_PER_EMAIL: '100000',
  // Tắt email trong test (dù .env trên máy có Mailpit); test email thay MailService bằng bản giả.
  SMTP_HOST: '',
};

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] ??= value;
}
