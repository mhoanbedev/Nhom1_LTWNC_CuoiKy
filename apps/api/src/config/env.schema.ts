import { z } from 'zod';

/**
 * Biến môi trường của API. App chỉ khởi động khi env khớp schema này.
 * Biến của Cloudinary, Google, JWT... thêm vào đây ở đúng bước dùng đến.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_URL: z.url(),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'phải là chuỗi kết nối PostgreSQL (postgresql://...)'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Hàm `validate` cho ConfigModule: trả env đã chuẩn hoá (ép kiểu, điền mặc định),
 * hoặc ném lỗi liệt kê từng biến sai để app dừng ngay khi khởi động.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(env)';
    return `  - ${key}: ${issue.message}`;
  });
  throw new Error(`Biến môi trường không hợp lệ:\n${lines.join('\n')}\nXem apps/api/.env.example.`);
}
