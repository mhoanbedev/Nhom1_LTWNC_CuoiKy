import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ErrorCode, Role, UserStatus } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { CompaniesService } from '../companies/companies.service';
import type { Company } from '../companies/entities/company.entity';
import { UsersService } from '../users/users.service';
import { AccountsService } from './accounts.service';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier, type GoogleIdentity } from './google/google-id-token.verifier';
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
    findByIdWithPassword: jest.fn<Promise<User | null>, [string]>(),
    findByEmail: jest.fn<Promise<User | null>, [string]>(),
    createRecruiter: jest.fn<Promise<User>, [unknown, unknown]>(),
    setCompany: jest.fn<Promise<void>, [string, string, unknown]>(),
    updateProfile: jest.fn<Promise<User>, [string, object]>(),
    setPassword: jest.fn<Promise<User>, [string, string]>(),
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
  const accountsService = {
    findUserId: jest.fn<Promise<string | null>, [string, string]>(),
    link: jest.fn<Promise<void>, [string, string, string]>(),
  };
  const googleVerifier = { verify: jest.fn<Promise<GoogleIdentity>, [string]>() };
  const companiesService = {
    createForOwner: jest.fn<Promise<Company>, [string, unknown, unknown]>(),
  };
  /** Transaction giả: chạy callback với một manager giả, lỗi trong callback được ném tiếp. */
  const manager = { fake: 'manager' };
  const dataSource = {
    transaction: jest.fn((run: (m: typeof manager) => Promise<unknown>) => run(manager)),
  };
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    dataSource.transaction.mockImplementation((run) => run(manager));
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    refreshTokenService.issueForNewSession.mockResolvedValue(issued);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: JwtService, useValue: jwtService },
        { provide: AccountsService, useValue: accountsService },
        { provide: GoogleIdTokenVerifier, useValue: googleVerifier },
        { provide: CompaniesService, useValue: companiesService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: jwtConfig.KEY, useValue: { accessSecret: 'x', accessTtlSeconds: 900 } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('registerRecruiter', () => {
    const input = {
      email: 'hr@example.com',
      password: 'abc12345',
      name: 'Chị HR',
      company: { translations: { vi: { name: 'Công ty ABC' } } },
    };

    it('tạo nhà tuyển dụng và công ty trong cùng transaction, gắn companyId, trả token', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      passwordService.hash.mockResolvedValue('argon-hash');
      usersService.createRecruiter.mockResolvedValue(
        makeUser({ id: 'hr-1', role: Role.RECRUITER, email: 'hr@example.com' }),
      );
      companiesService.createForOwner.mockResolvedValue({ id: 'company-1' } as Company);

      const result = await service.registerRecruiter(input, 'vi', client);

      expect(usersService.createRecruiter).toHaveBeenCalledWith(
        {
          email: 'hr@example.com',
          name: 'Chị HR',
          passwordHash: 'argon-hash',
          preferredLocale: 'vi',
        },
        manager,
      );
      expect(companiesService.createForOwner).toHaveBeenCalledWith('hr-1', input.company, manager);
      expect(usersService.setCompany).toHaveBeenCalledWith('hr-1', 'company-1', manager);
      expect(result.user).toMatchObject({
        id: 'hr-1',
        role: Role.RECRUITER,
        companyId: 'company-1',
      });
    });

    it('tạo công ty lỗi thì lỗi được ném ra và không cấp phiên', async () => {
      usersService.existsByEmail.mockResolvedValue(false);
      usersService.createRecruiter.mockResolvedValue(makeUser({ id: 'hr-1' }));
      companiesService.createForOwner.mockRejectedValue(new Error('FK industry'));
      await expect(service.registerRecruiter(input, 'vi', client)).rejects.toThrow('FK industry');
      expect(refreshTokenService.issueForNewSession).not.toHaveBeenCalled();
    });

    it('email đã dùng trả AUTH_EMAIL_TAKEN, không mở transaction', async () => {
      usersService.existsByEmail.mockResolvedValue(true);
      await expectAppError(
        service.registerRecruiter(input, 'vi', client),
        ErrorCode.AUTH_EMAIL_TAKEN,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
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

  describe('loginWithGoogle', () => {
    const identity: GoogleIdentity = {
      sub: 'google-sub-1',
      email: 'an@example.com',
      emailVerified: true,
      name: 'Nguyễn An',
      picture: 'https://lh3.googleusercontent.com/a/anh',
    };

    beforeEach(() => {
      googleVerifier.verify.mockResolvedValue(identity);
    });

    it('đã liên kết: đăng nhập đúng user đó, không liên kết lại', async () => {
      accountsService.findUserId.mockResolvedValue('user-1');
      usersService.findById.mockResolvedValue(makeUser());
      await expect(service.loginWithGoogle('id-token', 'vi', client)).resolves.toMatchObject({
        user: { id: 'user-1' },
      });
      expect(accountsService.findUserId).toHaveBeenCalledWith('google', 'google-sub-1');
      expect(accountsService.link).not.toHaveBeenCalled();
      expect(usersService.createCandidate).not.toHaveBeenCalled();
    });

    it('chưa liên kết, email đã xác minh trùng user có sẵn: liên kết vào user đó', async () => {
      accountsService.findUserId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(makeUser({ role: Role.RECRUITER }));
      const result = await service.loginWithGoogle('id-token', 'vi', client);
      expect(result.user).toMatchObject({ id: 'user-1', role: Role.RECRUITER });
      expect(accountsService.link).toHaveBeenCalledWith('user-1', 'google', 'google-sub-1');
      expect(usersService.createCandidate).not.toHaveBeenCalled();
    });

    it('chưa có gì: tạo ứng viên không mật khẩu, ngôn ngữ theo request, rồi liên kết', async () => {
      accountsService.findUserId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createCandidate.mockResolvedValue(
        makeUser({ id: 'user-moi', passwordHash: null }),
      );
      await service.loginWithGoogle('id-token', 'en', client);
      expect(usersService.createCandidate).toHaveBeenCalledWith({
        email: 'an@example.com',
        name: 'Nguyễn An',
        passwordHash: null,
        preferredLocale: 'en',
        avatarUrl: identity.picture,
      });
      expect(accountsService.link).toHaveBeenCalledWith('user-moi', 'google', 'google-sub-1');
    });

    it('Google không trả tên thì lấy phần trước @ của email', async () => {
      googleVerifier.verify.mockResolvedValue({ ...identity, name: null, picture: null });
      accountsService.findUserId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createCandidate.mockResolvedValue(makeUser());
      await service.loginWithGoogle('id-token', 'vi', client);
      expect(usersService.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'an', avatarUrl: null }),
      );
    });

    it('hai request tạo cùng lúc: request thua dùng user request kia vừa tạo', async () => {
      accountsService.findUserId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser());
      usersService.createCandidate.mockRejectedValue(new AppException(ErrorCode.AUTH_EMAIL_TAKEN));
      await expect(service.loginWithGoogle('id-token', 'vi', client)).resolves.toMatchObject({
        user: { id: 'user-1' },
      });
    });

    it('email chưa xác minh thì không liên kết, không tạo user', async () => {
      googleVerifier.verify.mockResolvedValue({ ...identity, emailVerified: false });
      accountsService.findUserId.mockResolvedValue(null);
      await expectAppError(
        service.loginWithGoogle('id-token', 'vi', client),
        ErrorCode.AUTH_GOOGLE_EMAIL_UNVERIFIED,
      );
      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.createCandidate).not.toHaveBeenCalled();
    });

    it('tài khoản bị khóa trả AUTH_ACCOUNT_LOCKED, không cấp phiên', async () => {
      accountsService.findUserId.mockResolvedValue('user-1');
      usersService.findById.mockResolvedValue(makeUser({ status: UserStatus.LOCKED }));
      await expectAppError(
        service.loginWithGoogle('id-token', 'vi', client),
        ErrorCode.AUTH_ACCOUNT_LOCKED,
      );
      expect(refreshTokenService.issueForNewSession).not.toHaveBeenCalled();
    });

    it('id_token sai: lỗi từ bước verify được ném tiếp', async () => {
      googleVerifier.verify.mockRejectedValue(
        new AppException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID),
      );
      await expectAppError(
        service.loginWithGoogle('sai', 'vi', client),
        ErrorCode.AUTH_GOOGLE_TOKEN_INVALID,
      );
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

  describe('me / updateMe', () => {
    it('me đọc user từ DB và không trả passwordHash', async () => {
      usersService.findById.mockResolvedValue(makeUser({ name: 'Tên mới' }));
      const me = await service.me('user-1');
      expect(me).toMatchObject({ id: 'user-1', name: 'Tên mới' });
      expect(me).not.toHaveProperty('passwordHash');
    });

    it('me khi user đã bị xóa trả AUTH_TOKEN_INVALID', async () => {
      usersService.findById.mockResolvedValue(null);
      await expectAppError(service.me('user-1'), ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('updateMe chuyển dữ liệu cho UsersService và trả user đã cập nhật', async () => {
      usersService.updateProfile.mockResolvedValue(makeUser({ preferredLocale: 'en' }));
      const me = await service.updateMe('user-1', { preferredLocale: 'en' });
      expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', { preferredLocale: 'en' });
      expect(me.preferredLocale).toBe('en');
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      passwordService.hash.mockResolvedValue('hash-moi');
      usersService.setPassword.mockResolvedValue(makeUser());
    });

    it('đúng mật khẩu hiện tại: thu hồi mọi phiên, đặt mật khẩu mới rồi mở phiên mới', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(true);

      const result = await service.changePassword(
        'user-1',
        { currentPassword: 'cu123456', newPassword: 'moi123456' },
        client,
      );

      expect(passwordService.verify).toHaveBeenCalledWith('hash', 'cu123456');
      expect(usersService.setPassword).toHaveBeenCalledWith('user-1', 'hash-moi');
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
      // Thu hồi phiên cũ phải xảy ra trước khi đổi mật khẩu.
      expect(refreshTokenService.revokeAllForUser.mock.invocationCallOrder[0]).toBeLessThan(
        usersService.setPassword.mock.invocationCallOrder[0] ?? 0,
      );
      expect(result.refreshToken).toBe('refresh-token-goc');
    });

    it('sai mật khẩu hiện tại trả AUTH_PASSWORD_INCORRECT, không đổi gì', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser());
      passwordService.verify.mockResolvedValue(false);
      await expectAppError(
        service.changePassword(
          'user-1',
          { currentPassword: 'sai', newPassword: 'moi123456' },
          client,
        ),
        ErrorCode.AUTH_PASSWORD_INCORRECT,
      );
      expect(usersService.setPassword).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('tài khoản có mật khẩu mà không gửi mật khẩu hiện tại cũng bị từ chối', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser());
      await expectAppError(
        service.changePassword('user-1', { newPassword: 'moi123456' }, client),
        ErrorCode.AUTH_PASSWORD_INCORRECT,
      );
    });

    it('tài khoản chỉ có Google được đặt mật khẩu lần đầu không cần mật khẩu cũ', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser({ passwordHash: null }));
      await service.changePassword('user-1', { newPassword: 'moi123456' }, client);
      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(usersService.setPassword).toHaveBeenCalledWith('user-1', 'hash-moi');
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
