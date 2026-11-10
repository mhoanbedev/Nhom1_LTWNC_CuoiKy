import type { Locale } from '@ltwnc/shared';
import enMail from '../../i18n/en/mail.json';
import enNotifications from '../../i18n/en/notifications.json';
import viMail from '../../i18n/vi/mail.json';
import viNotifications from '../../i18n/vi/notifications.json';
import {
  EMAIL_STATUSES,
  escapeHtml,
  renderApplicationStatusEmail,
  type ApplicationStatusEmailInput,
} from './application-status-email';

/** Hàm dịch giống nestjs-i18n: tra khóa có dấu chấm trong file json, thay `{tham số}`. */
function translator(locale: Locale) {
  const files =
    locale === 'vi'
      ? { mail: viMail, notifications: viNotifications }
      : { mail: enMail, notifications: enNotifications };
  return (key: string, args: Record<string, string> = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        files,
      );
    if (typeof value !== 'string') throw new Error(`Thiếu khóa dịch ${key}`);
    return value.replace(/\{(\w+)\}/g, (_match, name: string) => args[name] ?? `{${name}}`);
  };
}

const input: ApplicationStatusEmailInput = {
  to: 'an@test.local',
  locale: 'vi',
  candidateName: 'Nguyễn An',
  jobTitle: 'Thực tập Backend',
  companyName: 'Công ty A',
  status: 'INTERVIEW',
  note: 'Phỏng vấn 9h thứ Hai',
  url: 'http://localhost:3000/vi',
};

describe('renderApplicationStatusEmail', () => {
  it('tiếng Việt: tiêu đề kèm tên tin và trạng thái; có lời nhắn và link', () => {
    const mail = renderApplicationStatusEmail(input, translator('vi'));
    expect(mail.to).toBe('an@test.local');
    expect(mail.subject).toBe('[Thực tập Backend] Hồ sơ ứng tuyển: Phỏng vấn');
    expect(mail.text).toContain('Chào Nguyễn An,');
    expect(mail.text).toContain('Công ty A mời bạn phỏng vấn cho vị trí "Thực tập Backend".');
    expect(mail.text).toContain('Lời nhắn từ nhà tuyển dụng: Phỏng vấn 9h thứ Hai');
    expect(mail.text).toContain('Xem chi tiết: http://localhost:3000/vi');
    expect(mail.html).toContain('<a href="http://localhost:3000/vi">Xem chi tiết</a>');
  });

  it('tiếng Anh, trúng tuyển, không có lời nhắn', () => {
    const mail = renderApplicationStatusEmail(
      { ...input, locale: 'en', status: 'PASSED', note: null, url: 'http://localhost:3000/en' },
      translator('en'),
    );
    expect(mail.subject).toBe('[Thực tập Backend] Application update: Passed');
    expect(mail.text).toContain('Congratulations!');
    expect(mail.text).not.toContain('Message from the recruiter');
    expect(mail.html).not.toContain('<i>');
  });

  it('escape HTML trong dữ liệu người dùng nhập; bản text giữ nguyên', () => {
    const mail = renderApplicationStatusEmail(
      {
        ...input,
        status: 'FAILED',
        companyName: '<b>Công ty</b>',
        note: '<script>alert(1)</script>',
      },
      translator('vi'),
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.html).toContain('&lt;b&gt;Công ty&lt;/b&gt;');
    expect(mail.text).toContain('<script>alert(1)</script>');
  });
});

describe('EMAIL_STATUSES', () => {
  it('chỉ gửi khi phỏng vấn, trúng tuyển, không đạt', () => {
    expect([...EMAIL_STATUSES].sort()).toEqual(['FAILED', 'INTERVIEW', 'PASSED']);
  });
});

describe('escapeHtml', () => {
  it('escape đủ 5 ký tự đặc biệt', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
