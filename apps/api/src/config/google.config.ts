import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(googleConfig.KEY) config: ConfigType<typeof googleConfig>`. */
export const googleConfig = registerAs('google', () => {
  const env = envSchema.parse(process.env);
  return { clientId: env.GOOGLE_CLIENT_ID };
});
