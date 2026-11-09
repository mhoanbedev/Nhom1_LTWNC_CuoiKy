import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ErrorCode, Role, UserStatus } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import {
  RefreshTokenService,
  type ClientInfo,
  type IssuedRefreshToken,
} from './refresh-token.service';

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

const client: ClientInfo = { userAgent: 'jest', ip: '127.0.0.1' };

const issued: IssuedRefreshToken = {
  id: 'rt-1',
  userId: 'user-1',
  refreshToken: 'refresh-token-goc',
  refreshTokenExpiresAt: new Date('2026-11-16T00:00:00.000Z'),
};

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
    findById: jest.fn<Promise<User | null>, [string]>(),
  };
  const passwordService = {
    hash: jest.fn<Promise<string>, [string]>(),
    verify: jest.fn<Promise<boolean>, [string, string]>(),
    verifyDummy: jest.fn<Promise<void>, [string]>(),
  };
  const refreshTokenService = {
    issueForNewSession: jest.fn<Promise<IssuedRefreshToken>, [string, ClientInfo]>(),
    rotate: jest.fn<Promise<IssuedRefreshToken>, [string, ClientInfo]>(),
    revokeSession: jest.fn<Promise<void>, [string, string]>(),
    revokeAllForUser: jest.fn<Promise<void>, [string]>(),
  };
  const jwtService = { signAsync: jest.fn<Promise<string>, [object]>() };
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    refreshTokenService.issueForNewSession.mockResolvedValue(issued);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: JwtService, useValue: jwtService },
        { provide: jwtConfig.KEY, useValue: { accessSecret: 'x', accessTtlSeconds: 900 } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('registerCandidate', () => {
    const input = { email: 'an@example.com', password: 'abc12345', name: 'An' };

    it('băm mật khẩu, tạo ứng viên theo ngôn ngữ lúc đăng ký và trả cặp token', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      passwordService.hash.mockResolvedValue('argon-hash');
      usersService.createCandidate.mockResolvedValue(makeUser({ preferredLocale: 'en' }));

      const result = await service.registerCandidate(input, 'en', client);

      expect(usersService.createCandidate).toHaveBeenCalledWith({
        email: 'an@example.com',
        name: 'An',
        passwordHash: 'argon-hash',
        preferredLocale: 'en',
      });
      expect(result).toMatchObject({
        accessToken: 'signed.jwt.token',
        refreshToken: 'refresh-token-goc',
        refreshTokenExpiresAt: '2026-11-16T00:00:00.000Z',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', role: Role.CANDIDATE });
      expect(refreshTokenService.issueForNewSession).toHaveBeenCalledWith('user-1', client);
    });

    it('email đã dùng trả AUTH_EMAIL_TAKEN và không băm mật khẩu', async () => {
      usersService.existsByEmail.mockResolvedValue(true);
      await expectAppError(
        service.registerCandidate(input, 'vi', client),
        ErrorCode.AUTH_EMAIL_TAKEN,
      );
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('mốc hết hạn access token = bây giờ + TTL', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      usersService.createCandidate.mockResolvedValue(makeUser());
      const before = Date.now();
      const result = await service.registerCandidate(input, 'vi', client);
      const expiresAt = new Date(result.accessTokenExpiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 900_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
    });
  });

  describe('login', () => {
    const input = { email: 'an@example.com', password: 'abc12345' };

    it('đúng email và mật khẩu thì mở phiên mới', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(true);
      await expect(service.login(input, client)).resolves.toMatchObject({
        accessToken: 'signed.jwt.token',
        refreshToken: 'refresh-token-goc',
      });
    });

    it('email không tồn tại trả AUTH_INVALID_CREDENTIALS và vẫn chạy kiểm giả', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      await expectAppError(service.login(input, client), ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(passwordService.verifyDummy).toHaveBeenCalled();
    });

    it('tài khoản chỉ có Google (không có mật khẩu) trả AUTH_INVALID_CREDENTIALS', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser({ passwordHash: null }));
      await expectAppError(service.login(input, client), ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('sai mật khẩu trả AUTH_INVALID_CREDENTIALS, không cấp refresh token', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(false);
      await expectAppError(service.login(input, client), ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(refreshTokenService.issueForNewSession).not.toHaveBeenCalled();
    });

    it('tài khoản khóa trả AUTH_ACCOUNT_LOCKED khi mật khẩu đúng', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      passwordService.verify.mockResolvedValue(true);
      await expectAppError(service.login(input, client), ErrorCode.AUTH_ACCOUNT_LOCKED);
    });

    it('tài khoản khóa nhưng sai mật khẩu chỉ báo sai thông tin đăng nhập', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      passwordService.verify.mockResolvedValue(false);
      await expectAppError(service.login(input, client), ErrorCode.AUTH_INVALID_CREDENTIALS);
    });
  });

  describe('refresh', () => {
    it('xoay token rồi trả access token mới cho đúng user', async () => {
      refreshTokenService.rotate.mockResolvedValue({ ...issued, refreshToken: 'token-moi' });
      usersService.findById.mockResolvedValue(makeUser());
      await expect(service.refresh('token-cu', client)).resolves.toMatchObject({
        accessToken: 'signed.jwt.token',
        refreshToken: 'token-moi',
        user: { id: 'user-1' },
      });
    });

    it('user bị khóa thì thu hồi mọi phiên và trả AUTH_ACCOUNT_LOCKED', async () => {
      refreshTokenService.rotate.mockResolvedValue(issued);
      usersService.findById.mockResolvedValue(makeUser({ status: UserStatus.LOCKED }));
      await expectAppError(service.refresh('token-cu', client), ErrorCode.AUTH_ACCOUNT_LOCKED);
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('user không còn tồn tại trả AUTH_REFRESH_INVALID', async () => {
      refreshTokenService.rotate.mockResolvedValue(issued);
      usersService.findById.mockResolvedValue(null);
      await expectAppError(service.refresh('token-cu', client), ErrorCode.AUTH_REFRESH_INVALID);
    });

    it('lỗi từ bước xoay vòng (dùng lại token) được ném tiếp', async () => {
      refreshTokenService.rotate.mockRejectedValue(new AppException(ErrorCode.AUTH_REFRESH_REUSED));
      await expectAppError(service.refresh('token-cu', client), ErrorCode.AUTH_REFRESH_REUSED);
    });
  });

  describe('logout', () => {
    it('đăng xuất phiên hiện tại chỉ thu hồi token của chính user', async () => {
      await service.logout('token', 'user-1');
      expect(refreshTokenService.revokeSession).toHaveBeenCalledWith('token', 'user-1');
    });

    it('đăng xuất mọi thiết bị thu hồi mọi token của user', async () => {
      await service.logoutAll('user-1');
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
