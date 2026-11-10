/**
 * `make mail-check`: gửi một email thử qua SMTP trong .env. Dev (Mailpit) thì mở
 * http://localhost:8025 để xem; SMTP thật thì gửi tới MAIL_CHECK_TO (mặc định chính MAIL_FROM).
 */
import { existsSync } from 'node:fs';
import { validateEnv } from '../../config/env.schema';
import { MailService } from './mail.service';

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = validateEnv(process.env);
  if (!env.SMTP_HOST) throw new Error('Chưa đặt SMTP_HOST trong .env');
  const service = new MailService({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER ?? null,
    pass: env.SMTP_PASS ?? null,
    from: env.MAIL_FROM,
  });
  const to = process.env.MAIL_CHECK_TO ?? env.MAIL_FROM;
  const sentAt = new Date().toLocaleString('vi-VN');
  const ok = await service.deliver({
    to,
    subject: `LTWNC mail-check ${sentAt}`,
    text: `Email thử từ make mail-check lúc ${sentAt}. SMTP ${env.SMTP_HOST}:${env.SMTP_PORT} hoạt động.`,
    html: `<p>Email thử từ <code>make mail-check</code> lúc ${sentAt}.</p><p>SMTP <b>${env.SMTP_HOST}:${env.SMTP_PORT}</b> hoạt động.</p>`,
  });
  if (!ok) throw new Error(`Không gửi được qua ${env.SMTP_HOST}:${env.SMTP_PORT} (xem log ở trên)`);
  console.log(`Đã gửi tới ${to} qua ${env.SMTP_HOST}:${env.SMTP_PORT}.`);
  if (env.SMTP_HOST === 'localhost') {
    console.log(`Mở http://localhost:${process.env.MAILPIT_UI_PORT ?? '8025'} để xem (Mailpit).`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
