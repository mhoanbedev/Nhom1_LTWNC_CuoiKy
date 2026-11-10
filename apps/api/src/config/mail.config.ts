import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(mailConfig.KEY) config: ConfigType<typeof mailConfig>`. */
export const mailConfig = registerAs('mail', () => {
  const env = envSchema.parse(process.env);
  return {
    host: env.SMTP_HOST ?? null,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER ?? null,
    pass: env.SMTP_PASS ?? null,
    from: env.MAIL_FROM,
  };
});

export type MailConfig = ReturnType<typeof mailConfig>;
