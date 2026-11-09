import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(revalidateConfig.KEY) config: ConfigType<typeof revalidateConfig>`. */
export const revalidateConfig = registerAs('revalidate', () => {
  const env = envSchema.parse(process.env);
  return {
    url: env.REVALIDATE_URL ?? null,
    secret: env.REVALIDATE_SECRET ?? null,
  };
});
