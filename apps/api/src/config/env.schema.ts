import { z } from 'zod';
import { DURATION_PATTERN } from '../common/utils/duration';

/** Biến khai trong .env nhưng để trống (`KEY=`) coi như không đặt. */
const emptyAsUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const duration = (fallback: string) =>
  z.string().regex(DURATION_PATTERN, 'dạng <số><s|m|h|d>, vd 15m, 7d').default(fallback);

/**
 * Biến môi trường của API. App chỉ khởi động khi env khớp schema này.
 * Biến của Cloudinary, Google, JWT... thêm vào đây ở đúng bước dùng đến.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_URL: z.url(),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'phải là chuỗi kết nối PostgreSQL (postgresql://...)'),
    JWT_ACCESS_SECRET: z.string().min(32, 'tối thiểu 32 ký tự; `make env` tự sinh khi để trống'),
    JWT_ACCESS_EXPIRES_IN: duration('15m'),
    REFRESH_TOKEN_EXPIRES_IN: duration('7d'),
    REFRESH_TOKEN_GRACE_SECONDS: z.coerce.number().int().min(0).max(300).default(30),
    RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).default(30),
    RATE_LIMIT_LOGIN_PER_EMAIL: z.coerce.number().int().min(1).default(10),
    CLOUDINARY_CLOUD_NAME: z.string().min(1, 'lấy ở Cloudinary Dashboard'),
    CLOUDINARY_API_KEY: z.string().min(1, 'lấy ở Cloudinary Settings → API Keys'),
    CLOUDINARY_API_SECRET: z.string().min(1, 'lấy ở Cloudinary Settings → API Keys'),
    GOOGLE_CLIENT_ID: z
      .string()
      .regex(
        /\.apps\.googleusercontent\.com$/,
        'Client ID của OAuth client Google (…apps.googleusercontent.com)',
      ),
    /** Route Handler revalidate bên Next. Để trống: không gọi webhook, chỉ ghi log (dev). */
    REVALIDATE_URL: emptyAsUndefined(z.url().optional()),
    REVALIDATE_SECRET: emptyAsUndefined(z.string().min(16, 'tối thiểu 16 ký tự').optional()),
    /** SMTP gửi email (dev: Mailpit). Để trống SMTP_HOST: tắt email, chỉ ghi log. */
    SMTP_HOST: emptyAsUndefined(z.string().optional()),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: emptyAsUndefined(z.string().optional()),
    SMTP_PASS: emptyAsUndefined(z.string().optional()),
    MAIL_FROM: z.string().min(3).default('Cổng thực tập <no-reply@ltwnc.local>'),
  })
  .refine((env) => !env.SMTP_USER === !env.SMTP_PASS, {
    path: ['SMTP_PASS'],
    message: 'SMTP_USER và SMTP_PASS phải cùng có hoặc cùng để trống',
  })
  .refine((env) => !env.REVALIDATE_URL || env.REVALIDATE_SECRET, {
    path: ['REVALIDATE_SECRET'],
    message: 'bắt buộc khi có REVALIDATE_URL',
  })
  // Production quên đặt thì không có lỗi nào hiện ra, chỉ là trang ISR chậm cập nhật tới 1 giờ;
  // nên bắt buộc ngay lúc khởi động. Dev được để trống.
  .refine((env) => env.NODE_ENV !== 'production' || env.REVALIDATE_URL, {
    path: ['REVALIDATE_URL'],
    message: 'bắt buộc khi NODE_ENV=production (https://<domain-vercel>/api/revalidate)',
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
