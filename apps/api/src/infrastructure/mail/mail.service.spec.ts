import { createTransport } from 'nodemailer';
import type { MailConfig } from '../../config/mail.config';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const sendMail = jest.fn<Promise<unknown>, [object]>();
const config: MailConfig = {
  host: 'localhost',
  port: 1025,
  secure: false,
  user: null,
  pass: null,
  from: 'Cổng thực tập <no-reply@ltwnc.local>',
};
const message = { to: 'an@test.local', subject: 'Thử', text: 'Nội dung', html: '<p>Nội dung</p>' };

describe('MailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createTransport).mockReturnValue({ sendMail } as never);
  });

  it('gửi qua SMTP kèm địa chỉ gửi MAIL_FROM', async () => {
    sendMail.mockResolvedValue({});
    await expect(new MailService(config).deliver(message)).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 1025, secure: false, auth: undefined }),
    );
    expect(sendMail).toHaveBeenCalledWith({ from: config.from, ...message });
  });

  it('có SMTP_USER/SMTP_PASS thì đăng nhập SMTP', () => {
    new MailService({ ...config, user: 'u', pass: 'p' });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'u', pass: 'p' } }),
    );
  });

  it('chưa đặt SMTP_HOST: không tạo kết nối, bỏ qua', async () => {
    const service = new MailService({ ...config, host: null });
    expect(createTransport).not.toHaveBeenCalled();
    await expect(service.deliver(message)).resolves.toBe(false);
  });

  it('SMTP lỗi: không ném lỗi, trả false', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new MailService(config);
    await expect(service.deliver(message)).resolves.toBe(false);
    expect(() => service.send(message)).not.toThrow();
  });
});
