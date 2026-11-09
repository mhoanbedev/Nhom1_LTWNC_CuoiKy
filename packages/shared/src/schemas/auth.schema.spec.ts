import { loginSchema, passwordSchema, registerCandidateSchema } from './auth.schema';

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
