import {
  ApplicationStatus,
  NotificationType,
  type Locale,
  type NotificationPayload,
} from '@ltwnc/shared';
import en from '../../i18n/en/notifications.json';
import vi from '../../i18n/vi/notifications.json';
import { renderNotification, type TranslateNotification } from './notification-renderer';

type Dict = Record<string, unknown>;
const FILES: Record<Locale, Dict> = { vi, en };

/** Bản dịch tối giản giống nestjs-i18n: tra khóa có dấu chấm, điền `{tham số}`. */
const translator =
  (locale: Locale): TranslateNotification =>
  (key, args = {}) => {
    const text = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Dict)?.[part], FILES[locale]);
    if (typeof text !== 'string') throw new Error(`Thiếu khóa ${key} (${locale})`);
    return text.replace(/\{(\w+)\}/g, (_m, name: string) => args[name] ?? `{${name}}`);
  };

const render = (payload: NotificationPayload, locale: Locale) =>
  renderNotification(payload, locale, translator(locale));

const jobTitle = { vi: 'Thực tập Backend', en: 'Backend Intern' };

describe('renderNotification', () => {
  it('NEW_APPLICATION: tên ứng viên và tên tin theo ngôn ngữ', () => {
    const payload: NotificationPayload = {
      type: NotificationType.NEW_APPLICATION,
      data: { applicationId: 'a', jobId: 'j', jobTitle, candidateName: 'Nguyễn An' },
    };
    expect(render(payload, 'vi')).toEqual({
      title: 'Có đơn ứng tuyển mới',
      body: 'Nguyễn An vừa ứng tuyển vào tin "Thực tập Backend"',
    });
    expect(render(payload, 'en').body).toBe('Nguyễn An applied to "Backend Intern"');
  });

  it('APPLICATION_STATUS_CHANGED: dịch tên trạng thái, có ghi chú thì nối thêm', () => {
    const payload: NotificationPayload = {
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      data: {
        applicationId: 'a',
        jobId: 'j',
        jobTitle,
        fromStatus: ApplicationStatus.REVIEWING,
        toStatus: ApplicationStatus.INTERVIEW,
        note: 'Mời phỏng vấn 9h thứ Hai',
        candidateName: null,
      },
    };
    expect(render(payload, 'vi').body).toBe(
      '"Thực tập Backend": Đang xem xét → Phỏng vấn. Ghi chú: Mời phỏng vấn 9h thứ Hai',
    );
    expect(render(payload, 'en').body).toBe(
      '"Backend Intern": Under review → Interview. Note: Mời phỏng vấn 9h thứ Hai',
    );
    const withoutNote = {
      ...payload,
      data: { ...payload.data, note: null },
    } as NotificationPayload;
    expect(render(withoutNote, 'vi').body).toBe('"Thực tập Backend": Đang xem xét → Phỏng vấn');
  });

  it('ứng viên rút đơn: câu riêng cho nhà tuyển dụng', () => {
    const payload: NotificationPayload = {
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      data: {
        applicationId: 'a',
        jobId: 'j',
        jobTitle,
        fromStatus: ApplicationStatus.SUBMITTED,
        toStatus: ApplicationStatus.WITHDRAWN,
        note: null,
        candidateName: 'Nguyễn An',
      },
    };
    expect(render(payload, 'vi')).toEqual({
      title: 'Ứng viên đã rút đơn',
      body: 'Nguyễn An đã rút đơn ứng tuyển vào tin "Thực tập Backend"',
    });
  });

  it('tin chưa có tên tiếng Anh thì dùng tên tiếng Việt', () => {
    const payload: NotificationPayload = {
      type: NotificationType.JOB_HIDDEN,
      data: { jobId: 'j', jobTitle: { vi: 'Thực tập', en: null }, reason: 'Sai thông tin' },
    };
    expect(render(payload, 'en').body).toBe(
      '"Thực tập" was hidden by an administrator. Reason: Sai thông tin',
    );
  });

  it('COMPANY_APPROVED, COMPANY_REJECTED kèm lý do', () => {
    const companyName = { vi: 'Công ty Á Đông', en: 'A Dong Co.' };
    expect(
      render(
        { type: NotificationType.COMPANY_APPROVED, data: { companyId: 'c', companyName } },
        'en',
      ).title,
    ).toBe('Company approved');
    expect(
      render(
        {
          type: NotificationType.COMPANY_REJECTED,
          data: { companyId: 'c', companyName, reason: 'Thiếu mã số thuế' },
        },
        'vi',
      ).body,
    ).toBe(
      'Công ty Á Đông bị từ chối. Lý do: Thiếu mã số thuế. Hãy cập nhật thông tin công ty để gửi duyệt lại.',
    );
  });
});

describe('File dịch notifications.json', () => {
  const keys = (node: Dict, prefix = ''): string[] =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'string' ? [`${prefix}${key}`] : keys(value as Dict, `${prefix}${key}.`),
    );

  it('vi và en có đúng cùng bộ khóa', () => {
    expect(keys(en).sort()).toEqual(keys(vi).sort());
  });

  it('có tên cho mọi trạng thái đơn', () => {
    for (const locale of ['vi', 'en'] as const) {
      expect(Object.keys((FILES[locale] as { STATUS: Dict }).STATUS).sort()).toEqual(
        Object.values(ApplicationStatus).sort(),
      );
    }
  });
});
