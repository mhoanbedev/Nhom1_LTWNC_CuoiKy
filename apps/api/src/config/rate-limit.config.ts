import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(rateLimitConfig.KEY) config: ConfigType<typeof rateLimitConfig>`. */
export const rateLimitConfig = registerAs('rateLimit', () => {
  const env = envSchema.parse(process.env);
  return {
    /** Số request mỗi phút trên một IP, tính riêng cho từng route auth công khai. */
    authPerMinute: env.RATE_LIMIT_AUTH_PER_MINUTE,
    /** Số lần đăng nhập trong 15 phút cho một email, bất kể IP. */
    loginPerEmail: env.RATE_LIMIT_LOGIN_PER_EMAIL,
  };
});
