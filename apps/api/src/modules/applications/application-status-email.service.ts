import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { ApplicationStatus, Locale } from '@ltwnc/shared';
import { I18nService } from 'nestjs-i18n';
import { appConfig } from '../../config/app.config';
import { MailService } from '../../infrastructure/mail/mail.service';
import { UsersService } from '../users/users.service';
import {
  EMAIL_STATUSES,
  renderApplicationStatusEmail,
  type EmailStatus,
} from './application-status-email';
import type { Application } from './entities/application.entity';

const pick = <T extends { locale: Locale }>(rows: T[] | undefined, locale: Locale) =>
  rows?.find((row) => row.locale === locale) ?? rows?.find((row) => row.locale === 'vi');

/**
 * Email cho ứng viên khi nhà tuyển dụng chuyển đơn sang INTERVIEW, PASSED, FAILED (mục 5.8), theo
 * ngôn ngữ ưa thích của ứng viên. Gọi SAU KHI đổi trạng thái đã commit; chạy nền, lỗi chỉ ghi log.
 */
@Injectable()
export class ApplicationStatusEmailService {
  private readonly logger = new Logger(ApplicationStatusEmailService.name);

  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly i18n: I18nService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  /**
   * `application` cần kèm `job.translations` và `job.company.translations`. Trạng thái không nằm
   * trong EMAIL_STATUSES thì bỏ qua. Không chờ, không ném lỗi.
   */
  notify(application: Application, status: ApplicationStatus, note: string | null): void {
    if (!EMAIL_STATUSES.has(status)) return;
    void this.send(application, status as EmailStatus, note).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Không dựng được email cho đơn ${application.id}: ${reason}`);
    });
  }

  private async send(application: Application, status: EmailStatus, note: string | null) {
    const candidate = await this.users.findById(application.candidateId);
    if (!candidate) return;
    const locale = candidate.preferredLocale;
    const message = renderApplicationStatusEmail(
      {
        to: candidate.email,
        locale,
        candidateName: candidate.name,
        jobTitle: pick(application.job?.translations, locale)?.title ?? '',
        companyName: pick(application.job?.company?.translations, locale)?.name ?? '',
        status,
        note,
        // Route trang đơn của ứng viên bên frontend chưa chốt: tạm về trang chủ theo ngôn ngữ.
        url: `${this.app.frontendUrl}/${locale}`,
      },
      (key, args) => this.i18n.t(key, { lang: locale, args }),
    );
    this.mail.send(message);
  }
}
