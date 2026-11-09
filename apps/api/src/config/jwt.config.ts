import { registerAs } from '@nestjs/config';
import { parseDurationToSeconds } from '../common/utils/duration';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>`. */
export const jwtConfig = registerAs('jwt', () => {
  const env = envSchema.parse(process.env);
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessTtlSeconds: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
    refreshTtlSeconds: parseDurationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
    /** Token vừa bị xoay trong khoảng này vẫn đổi được, không tính là dùng lại. */
    refreshGraceSeconds: env.REFRESH_TOKEN_GRACE_SECONDS,
  };
});
