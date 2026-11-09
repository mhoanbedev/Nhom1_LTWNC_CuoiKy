import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(databaseConfig.KEY) config: ConfigType<typeof databaseConfig>`. */
export const databaseConfig = registerAs('database', () => {
  const env = envSchema.parse(process.env);
  return {
    url: env.DATABASE_URL,
  };
});
