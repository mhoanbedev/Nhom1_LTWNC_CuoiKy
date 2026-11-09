import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ErrorCode, Role, UserStatus } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'an@example.com',
  name: 'An',
  role: Role.CANDIDATE,
  status: UserStatus.ACTIVE,
  preferredLocale: 'vi',
  passwordHash: 'hash',
  passwordChangedAt: null,
  avatarUrl: null,
  avatarPublicId: null,
  companyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

async function expectAppError(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
}

describe('AuthService', () => {
  const usersService = {
    existsByEmail: jest.fn<Promise<boolean>, [string]>(),
    createCandidate: jest.fn<Promise<User>, [unknown]>(),
    findByEmailWithPassword: jest.fn<Promise<User | null>, [string]>(),
  };
  const passwordService = {
    hash: jest.fn<Promise<string>, [string]>(),
    verify: jest.fn<Promise<boolean>, [string, string]>(),
    verifyDummy: jest.fn<Promise<void>, [string]>(),
  };
  const jwtService = { signAsync: jest.fn<Promise<string>, [object]>() };
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
        { provide: jwtConfig.KEY, useValue: { accessSecret: 'x', accessTtlSeconds: 900 } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('registerCandidate', () => {
    const input = { email: 'an@example.com', password: 'abc12345', name: 'An' };

    it('băm mật khẩu, tạo ứng viên theo ngôn ngữ lúc đăng ký và trả token', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      passwordService.hash.mockResolvedValue('argon-hash');
      usersService.createCandidate.mockResolvedValue(makeUser({ preferredLocale: 'en' }));

      const result = await service.registerCandidate(input, 'en');

      expect(usersService.createCandidate).toHaveBeenCalledWith({
        email: 'an@example.com',
        name: 'An',
        passwordHash: 'argon-hash',
        preferredLocale: 'en',
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', role: Role.CANDIDATE });
    });

    it('email đã dùng trả AUTH_EMAIL_TAKEN và không băm mật khẩu', async () => {
      usersService.existsByEmail.mockResolvedValue(true);
      await expectAppError(service.registerCandidate(input, 'vi'), ErrorCode.AUTH_EMAIL_TAKEN);
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('mốc hết hạn access token = bây giờ + TTL', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      usersService.createCandidate.mockResolvedValue(makeUser());
      const before = Date.now();
      const result = await service.registerCandidate(input, 'vi');
      const expiresAt = new Date(result.accessTokenExpiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 900_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
    });
  });

  describe('login', () => {
    const input = { email: 'an@example.com', password: 'abc12345' };

    it('đúng email và mật khẩu thì trả token', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(true);
      await expect(service.login(input)).resolves.toMatchObject({
        accessToken: 'signed.jwt.token',
      });
    });

    it('email không tồn tại trả AUTH_INVALID_CREDENTIALS và vẫn chạy kiểm giả', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      await expectAppError(service.login(input), ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(passwordService.verifyDummy).toHaveBeenCalled();
    });

    it('tài khoản chỉ có Google (không có mật khẩu) trả AUTH_INVALID_CREDENTIALS', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser({ passwordHash: null }));
      await expectAppError(service.login(input), ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('sai mật khẩu trả AUTH_INVALID_CREDENTIALS', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(false);
      await expectAppError(service.login(input), ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('tài khoản khóa trả AUTH_ACCOUNT_LOCKED khi mật khẩu đúng', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      passwordService.verify.mockResolvedValue(true);
      await expectAppError(service.login(input), ErrorCode.AUTH_ACCOUNT_LOCKED);
    });

    it('tài khoản khóa nhưng sai mật khẩu chỉ báo sai thông tin đăng nhập', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      passwordService.verify.mockResolvedValue(false);
      await expectAppError(service.login(input), ErrorCode.AUTH_INVALID_CREDENTIALS);
    });
  });
});
