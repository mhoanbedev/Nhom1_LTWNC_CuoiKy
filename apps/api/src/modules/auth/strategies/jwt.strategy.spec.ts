import { ErrorCode, Role, UserStatus } from '@ltwnc/shared';
import { AppException } from '../../../common/exceptions/app.exception';
import type { User } from '../../users/entities/user.entity';
import type { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'an@example.com',
    role: Role.RECRUITER,
    status: UserStatus.ACTIVE,
    preferredLocale: 'vi',
    companyId: 'company-1',
    passwordChangedAt: null,
    ...overrides,
  }) as User;

describe('JwtStrategy.validate', () => {
  const findById = jest.fn<Promise<User | null>, [string]>();
  const strategy = new JwtStrategy(
    { accessSecret: 'secret-secret-secret-secret-secret', accessTtlSeconds: 900 },
    { findById } as unknown as UsersService,
  );
  const nowSeconds = Math.floor(Date.now() / 1000);

  const expectCode = async (payload: unknown, code: ErrorCode): Promise<void> => {
    const error = await strategy.validate(payload).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(code);
  };

  beforeEach(() => findById.mockReset());

  it('trả user đọc từ DB, role lấy từ DB chứ không từ payload', async () => {
    findById.mockResolvedValue(user());
    const result = await strategy.validate({ sub: 'user-1', role: Role.ADMIN, iat: nowSeconds });
    expect(result).toEqual({
      id: 'user-1',
      email: 'an@example.com',
      role: Role.RECRUITER,
      companyId: 'company-1',
      preferredLocale: 'vi',
    });
  });

  it('payload sai dạng trả AUTH_TOKEN_INVALID', async () => {
    await expectCode({ sub: 1 }, ErrorCode.AUTH_TOKEN_INVALID);
    await expectCode({ sub: 'x', role: 'GUEST' }, ErrorCode.AUTH_TOKEN_INVALID);
  });

  it('user không còn tồn tại trả AUTH_TOKEN_INVALID', async () => {
    findById.mockResolvedValue(null);
    await expectCode({ sub: 'user-1', role: Role.CANDIDATE }, ErrorCode.AUTH_TOKEN_INVALID);
  });

  it('tài khoản khóa trả AUTH_ACCOUNT_LOCKED dù token còn hạn', async () => {
    findById.mockResolvedValue(user({ status: UserStatus.LOCKED }));
    await expectCode({ sub: 'user-1', role: Role.CANDIDATE }, ErrorCode.AUTH_ACCOUNT_LOCKED);
  });

  it('token cấp trước khi đổi mật khẩu bị từ chối', async () => {
    findById.mockResolvedValue(user({ passwordChangedAt: new Date((nowSeconds + 10) * 1000) }));
    await expectCode(
      { sub: 'user-1', role: Role.CANDIDATE, iat: nowSeconds },
      ErrorCode.AUTH_TOKEN_INVALID,
    );
  });

  it('token cấp cùng giây hoặc sau khi đổi mật khẩu vẫn hợp lệ', async () => {
    findById.mockResolvedValue(user({ passwordChangedAt: new Date(nowSeconds * 1000 + 700) }));
    await expect(
      strategy.validate({ sub: 'user-1', role: Role.CANDIDATE, iat: nowSeconds }),
    ).resolves.toMatchObject({ id: 'user-1' });
  });
});
