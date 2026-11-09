import {
  changePasswordSchema,
  loginSchema,
  passwordSchema,
  registerCandidateSchema,
  updateMeSchema,
} from './auth.schema';

describe('updateMeSchema', () => {
  it('nhận chỉ đổi tên hoặc chỉ đổi ngôn ngữ', () => {
    expect(updateMeSchema.safeParse({ name: 'An' }).success).toBe(true);
    expect(updateMeSchema.safeParse({ preferredLocale: 'en' }).success).toBe(true);
  });

  it('từ chối body rỗng với khóa dịch AT_LEAST_ONE_FIELD', () => {
    const result = updateMeSchema.safeParse({});
    expect(result.error?.issues[0]).toMatchObject({
      code: 'custom',
      params: { i18n: 'AT_LEAST_ONE_FIELD' },
    });
  });

  it('từ chối ngôn ngữ không hỗ trợ', () => {
    expect(updateMeSchema.safeParse({ preferredLocale: 'fr' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('mật khẩu mới phải đủ mạnh', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'cu', newPassword: 'yeu' }).success,
    ).toBe(false);
  });

  it('mật khẩu mới trùng mật khẩu cũ bị từ chối ở trường newPassword', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'abc12345',
      newPassword: 'abc12345',
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ['newPassword'],
      params: { i18n: 'PASSWORD_SAME_AS_CURRENT' },
    });
  });

  it('được bỏ trống mật khẩu hiện tại (tài khoản Google đặt mật khẩu lần đầu)', () => {
    expect(changePasswordSchema.safeParse({ newPassword: 'abc12345' }).success).toBe(true);
  });
});

describe('passwordSchema', () => {
  it.each(['abc12345', 'Matkhau2026', 'a1b2c3d4'])('nhận %s', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ['ngắn hơn 8 ký tự', 'abc123'],
    ['không có số', 'abcdefgh'],
    ['không có chữ', '12345678'],
  ])('từ chối mật khẩu %s', (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it('lỗi thiếu chữ hoặc số mang khóa dịch', () => {
    const result = passwordSchema.safeParse('12345678');
    expect(result.error?.issues[0]).toMatchObject({
      code: 'custom',
      params: { i18n: 'PASSWORD_LETTER_AND_DIGIT' },
    });
  });
});

describe('registerCandidateSchema', () => {
  it('chuẩn hoá email về chữ thường, bỏ khoảng trắng', () => {
    const result = registerCandidateSchema.parse({
      email: '  An.Nguyen@Example.COM ',
      password: 'abc12345',
      name: ' Nguyễn An ',
    });
    expect(result).toEqual({
      email: 'an.nguyen@example.com',
      password: 'abc12345',
      name: 'Nguyễn An',
    });
  });

  it('từ chối email sai định dạng', () => {
    const result = registerCandidateSchema.safeParse({
      email: 'abc',
      password: 'abc12345',
      name: 'An',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('không áp luật độ mạnh mật khẩu khi đăng nhập', () => {
    expect(loginSchema.safeParse({ email: 'a@b.vn', password: 'x' }).success).toBe(true);
  });
});
