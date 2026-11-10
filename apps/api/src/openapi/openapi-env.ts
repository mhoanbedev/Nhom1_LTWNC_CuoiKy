/**
 * Env tối thiểu để dựng tài liệu OpenAPI mà không cần `.env` thật: AppModule kiểm env ngay lúc
 * import, dù chế độ preview không kết nối DB hay gọi dịch vụ nào. Phải import trước AppModule.
 * Chỉ điền biến còn thiếu; tài liệu không phụ thuộc giá trị các biến này.
 */
const placeholders: Record<string, string> = {
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  JWT_ACCESS_SECRET: 'openapi-only-placeholder-secret-0123456789',
  GOOGLE_CLIENT_ID: 'openapi.apps.googleusercontent.com',
  CLOUDINARY_CLOUD_NAME: 'openapi',
  CLOUDINARY_API_KEY: 'openapi',
  CLOUDINARY_API_SECRET: 'openapi',
};

for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ??= value;
}
