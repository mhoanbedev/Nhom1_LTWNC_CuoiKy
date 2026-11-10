import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { mailConfig, type MailConfig } from '../../config/mail.config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Chờ kết nối, gửi tối đa chừng này rồi bỏ, để SMTP chậm không giữ tài nguyên mãi. */
const SMTP_TIMEOUT_MS = 10_000;

/**
 * Lớp tích hợp duy nhất gửi email qua SMTP (dev: Mailpit; thật: đổi biến SMTP_* trong .env).
 * `send` không chờ và không bao giờ ném lỗi: email là phụ, lỗi chỉ ghi log, không ảnh hưởng request.
 * SMTP_HOST để trống thì tắt email, chỉ ghi log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(@Inject(mailConfig.KEY) private readonly config: MailConfig) {
    this.transporter = config.host
      ? createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
          connectionTimeout: SMTP_TIMEOUT_MS,
          greetingTimeout: SMTP_TIMEOUT_MS,
          socketTimeout: SMTP_TIMEOUT_MS,
        })
      : null;
  }

  /** Gửi nền, không chờ. Gọi SAU KHI transaction đã commit. */
  send(message: MailMessage): void {
    void this.deliver(message);
  }

  /** Gửi và trả về có thành công không. Không bao giờ ném lỗi. */
  async deliver(message: MailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`Bỏ qua email (chưa đặt SMTP_HOST): "${message.subject}"`);
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.config.from, ...message });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Gửi email thất bại (${reason}): "${message.subject}"`);
      return false;
    }
  }
}
