import {
  NotificationType,
  type LocalizedText,
  type Locale,
  type NotificationPayload,
} from '@ltwnc/shared';

/** Hàm dịch theo khóa trong src/i18n/<lang>/notifications.json, đã chọn sẵn ngôn ngữ. */
export type TranslateNotification = (key: string, args?: Record<string, string>) => string;

const pick = (text: LocalizedText, locale: Locale): string =>
  (locale === 'en' ? text.en : null) ?? text.vi;

/**
 * Dựng `title`, `body` của thông báo theo ngôn ngữ (mục 5.8: lưu type + tham số, dịch lúc đọc).
 * Tên tin, tên công ty lấy bản theo ngôn ngữ nếu có, không thì bản tiếng Việt.
 */
export function renderNotification(
  payload: NotificationPayload,
  locale: Locale,
  t: TranslateNotification,
): { title: string; body: string } {
  switch (payload.type) {
    case NotificationType.NEW_APPLICATION: {
      const { candidateName, jobTitle } = payload.data;
      return {
        title: t('NEW_APPLICATION.title'),
        body: t('NEW_APPLICATION.body', { candidateName, jobTitle: pick(jobTitle, locale) }),
      };
    }
    case NotificationType.APPLICATION_STATUS_CHANGED: {
      const { jobTitle, fromStatus, toStatus, note, candidateName } = payload.data;
      const title = pick(jobTitle, locale);
      // Ứng viên rút đơn: người nhận là nhà tuyển dụng, câu khác hẳn.
      if (toStatus === 'WITHDRAWN' && candidateName) {
        return {
          title: t('APPLICATION_WITHDRAWN.title'),
          body: t('APPLICATION_WITHDRAWN.body', { candidateName, jobTitle: title }),
        };
      }
      const body = t('APPLICATION_STATUS_CHANGED.body', {
        jobTitle: title,
        fromStatus: t(`STATUS.${fromStatus}`),
        toStatus: t(`STATUS.${toStatus}`),
      });
      return {
        title: t('APPLICATION_STATUS_CHANGED.title'),
        body: note ? `${body}. ${t('APPLICATION_STATUS_CHANGED.note', { note })}` : body,
      };
    }
    case NotificationType.COMPANY_APPROVED:
      return {
        title: t('COMPANY_APPROVED.title'),
        body: t('COMPANY_APPROVED.body', { companyName: pick(payload.data.companyName, locale) }),
      };
    case NotificationType.COMPANY_REJECTED:
      return {
        title: t('COMPANY_REJECTED.title'),
        body: t('COMPANY_REJECTED.body', {
          companyName: pick(payload.data.companyName, locale),
          reason: payload.data.reason,
        }),
      };
    case NotificationType.JOB_HIDDEN:
      return {
        title: t('JOB_HIDDEN.title'),
        body: t('JOB_HIDDEN.body', {
          jobTitle: pick(payload.data.jobTitle, locale),
          reason: payload.data.reason,
        }),
      };
  }
}
