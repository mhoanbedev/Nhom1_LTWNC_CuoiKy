import { ApplicationStatus, type Locale } from '@ltwnc/shared';
import type { MailMessage } from '../../infrastructure/mail/mail.service';

/** Trạng thái đơn có gửi email cho ứng viên (mục 5.8 của đặc tả). */
export const EMAIL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.PASSED,
  ApplicationStatus.FAILED,
]);

export type EmailStatus = 'INTERVIEW' | 'PASSED' | 'FAILED';

export interface ApplicationStatusEmailInput {
  to: string;
  locale: Locale;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  status: EmailStatus;
  note: string | null;
  /** Link nút "Xem chi tiết" (trang của frontend theo ngôn ngữ). */
  url: string;
}

/** Hàm dịch theo khóa trong src/i18n/<lang>/*.json (vd `mail.APPLICATION_STATUS.subject`), đã chọn ngôn ngữ. */
export type TranslateMail = (key: string, args?: Record<string, string>) => string;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape dữ liệu người dùng nhập (tên tin, tên công ty, ghi chú) trước khi đặt vào HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Email báo đơn đổi trạng thái, theo ngôn ngữ ưa thích của ứng viên. Bản text dùng giá trị gốc;
 * bản HTML escape mọi giá trị do người dùng nhập để không chèn được thẻ HTML vào email.
 */
export function renderApplicationStatusEmail(
  input: ApplicationStatusEmailInput,
  t: TranslateMail,
): MailMessage {
  const key = (name: string) => `mail.APPLICATION_STATUS.${name}`;
  const status = t(`notifications.STATUS.${input.status}`);
  const raw = {
    name: input.candidateName,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
  };
  const safe = {
    name: escapeHtml(raw.name),
    jobTitle: escapeHtml(raw.jobTitle),
    companyName: escapeHtml(raw.companyName),
  };
  const cta = t(key('cta'));
  const footer = t(key('footer'));

  const text = [
    t(key('greeting'), raw),
    '',
    t(key(input.status), raw),
    ...(input.note ? ['', t(key('note'), { note: input.note })] : []),
    '',
    `${cta}: ${input.url}`,
    '',
    '--',
    footer,
  ].join('\n');

  const html = [
    `<p>${t(key('greeting'), safe)}</p>`,
    `<p>${t(key(input.status), safe)}</p>`,
    ...(input.note ? [`<p><i>${t(key('note'), { note: escapeHtml(input.note) })}</i></p>`] : []),
    `<p><a href="${escapeHtml(input.url)}">${cta}</a></p>`,
    `<hr><p style="color:#888;font-size:12px">${footer}</p>`,
  ].join('\n');

  return {
    to: input.to,
    subject: t(key('subject'), { jobTitle: input.jobTitle, status }),
    text,
    html,
  };
}
