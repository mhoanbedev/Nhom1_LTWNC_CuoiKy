import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ErrorCode,
  OAuthProvider,
  UserStatus,
  type AuthResponse,
  type AvatarResult,
  type AuthUser,
  type ChangePasswordInput,
  type Locale,
  type LoginInput,
  type RegisterCandidateInput,
  type RegisterRecruiterInput,
  type UpdateMeInput,
} from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import type { UploadedFileLike } from '../../common/files/image-file';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { CompaniesService } from '../companies/companies.service';
import { toAuthUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { AccountsService } from './accounts.service';
import { GoogleIdTokenVerifier, type GoogleIdentity } from './google/google-id-token.verifier';
import type { JwtPayload } from './jwt-payload';
import { PasswordService } from './password.service';
import {
  RefreshTokenService,
  type ClientInfo,
  type IssuedRefreshToken,
} from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly accountsService: AccountsService,
    private readonly googleVerifier: GoogleIdTokenVerifier,
    private readonly companiesService: CompaniesService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  /** Đăng ký ứng viên rồi đăng nhập luôn. Ngôn ngữ ưa thích lấy theo ngôn ngữ lúc đăng ký. */
  async registerCandidate(
    input: RegisterCandidateInput,
    locale: Locale,
    client: ClientInfo,
  ): Promise<AuthResponse> {
    if (await this.usersService.existsByEmail(input.email)) {
      throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }
    const user = await this.usersService.createCandidate({
      email: input.email,
      name: input.name,
      passwordHash: await this.passwordService.hash(input.password),
      preferredLocale: locale,
    });
    return this.startSession(user, client);
  }

  /**
   * Đăng ký nhà tuyển dụng kèm công ty (PENDING, chờ admin duyệt) rồi đăng nhập luôn.
   * User và công ty tạo trong một transaction: lỗi giữa chừng (vd industryId không tồn tại)
   * thì không để lại tài khoản thiếu công ty.
   */
  async registerRecruiter(
    input: RegisterRecruiterInput,
    locale: Locale,
    client: ClientInfo,
  ): Promise<AuthResponse> {
    if (await this.usersService.existsByEmail(input.email)) {
      throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }
    const passwordHash = await this.passwordService.hash(input.password);
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await this.usersService.createRecruiter(
        { email: input.email, name: input.name, passwordHash, preferredLocale: locale },
        manager,
      );
      const company = await this.companiesService.createForOwner(
        created.id,
        input.company,
        manager,
      );
      await this.usersService.setCompany(created.id, company.id, manager);
      created.companyId = company.id;
      return created;
    });
    return this.startSession(user, client);
  }

  /**
   * Email không tồn tại và sai mật khẩu trả cùng một lỗi, để không lộ email nào đã đăng ký.
   * Tài khoản khóa chỉ báo sau khi mật khẩu đúng.
   */
  async login(input: LoginInput, client: ClientInfo): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(input.email);
    if (!user?.passwordHash) {
      await this.passwordService.verifyDummy(input.password);
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const valid = await this.passwordService.verify(user.passwordHash, input.password);
    if (!valid) throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    if (user.status === UserStatus.LOCKED) throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);

    return this.startSession(user, client);
  }

  /**
   * Đăng nhập bằng `id_token` Google (Auth.js gọi sau khi Google trả về). Ba trường hợp:
   * đã liên kết thì đăng nhập user đó; email đã xác minh trùng user có sẵn thì liên kết vào;
   * chưa có gì thì tạo ứng viên mới, ngôn ngữ ưa thích theo ngôn ngữ của request.
   */
  async loginWithGoogle(
    idToken: string,
    locale: Locale,
    client: ClientInfo,
  ): Promise<AuthResponse> {
    const identity = await this.googleVerifier.verify(idToken);
    const user = await this.resolveGoogleUser(identity, locale);
    if (user.status === UserStatus.LOCKED) throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    return this.startSession(user, client);
  }

  /** Đổi refresh token lấy cặp token mới; user bị khóa trong lúc đó thì thu hồi mọi phiên. */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResponse> {
    const issued = await this.refreshTokenService.rotate(refreshToken, client);
    const user = await this.usersService.findById(issued.userId);
    if (!user) throw new AppException(ErrorCode.AUTH_REFRESH_INVALID);
    if (user.status === UserStatus.LOCKED) {
      await this.refreshTokenService.revokeAllForUser(user.id);
      throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    }
    return this.buildResponse(user, issued);
  }

  /** Thông tin user hiện tại, đọc mới từ DB (không lấy từ token). */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    return toAuthUser(user);
  }

  updateAvatar(userId: string, file: UploadedFileLike | undefined): Promise<AvatarResult> {
    return this.usersService.updateAvatar(userId, file);
  }

  async updateMe(userId: string, input: UpdateMeInput): Promise<AuthUser> {
    return toAuthUser(await this.usersService.updateProfile(userId, input));
  }

  /**
   * Đổi mật khẩu rồi mở phiên mới cho thiết bị đang dùng; mọi thiết bị khác bị đăng xuất.
   * Thứ tự: thu hồi phiên cũ trước, đặt mật khẩu sau, để lỗi giữa chừng không bao giờ
   * để lại tình trạng mật khẩu đã đổi mà phiên cũ vẫn sống.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    client: ClientInfo,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);

    // Tài khoản chỉ đăng nhập Google chưa có mật khẩu: được đặt lần đầu không cần mật khẩu cũ.
    if (user.passwordHash) {
      const valid =
        input.currentPassword !== undefined &&
        (await this.passwordService.verify(user.passwordHash, input.currentPassword));
      if (!valid) throw new AppException(ErrorCode.AUTH_PASSWORD_INCORRECT);
    }

    const newHash = await this.passwordService.hash(input.newPassword);
    await this.refreshTokenService.revokeAllForUser(user.id);
    const updated = await this.usersService.setPassword(user.id, newHash);
    return this.startSession(updated, client);
  }

  /** Đăng xuất phiên hiện tại. Token không tồn tại hay của người khác thì bỏ qua (idempotent). */
  logout(refreshToken: string, userId: string): Promise<void> {
    return this.refreshTokenService.revokeSession(refreshToken, userId);
  }

  /** Đăng xuất mọi thiết bị. */
  logoutAll(userId: string): Promise<void> {
    return this.refreshTokenService.revokeAllForUser(userId);
  }

  private async resolveGoogleUser(identity: GoogleIdentity, locale: Locale): Promise<User> {
    const linkedUserId = await this.accountsService.findUserId(OAuthProvider.GOOGLE, identity.sub);
    if (linkedUserId) {
      const linked = await this.usersService.findById(linkedUserId);
      if (linked) return linked;
    }

    // Chỉ liên kết hoặc tạo theo email Google đã xác minh, để không ai chiếm được email người khác.
    if (!identity.email || !identity.emailVerified) {
      throw new AppException(ErrorCode.AUTH_GOOGLE_EMAIL_UNVERIFIED);
    }
    const user =
      (await this.usersService.findByEmail(identity.email)) ??
      (await this.createGoogleCandidate(identity, identity.email, locale));

    // Tạo user rồi mới liên kết: nếu lỗi giữa hai bước, lần đăng nhập sau sẽ liên kết theo email.
    await this.accountsService.link(user.id, OAuthProvider.GOOGLE, identity.sub);
    return user;
  }

  private async createGoogleCandidate(
    identity: GoogleIdentity,
    email: string,
    locale: Locale,
  ): Promise<User> {
    try {
      return await this.usersService.createCandidate({
        email,
        name: (identity.name ?? email.split('@')[0] ?? email).slice(0, 100),
        passwordHash: null,
        preferredLocale: locale,
        avatarUrl: identity.picture && identity.picture.length <= 500 ? identity.picture : null,
      });
    } catch (error) {
      // Hai request đăng nhập Google cùng lúc: request kia vừa tạo user, dùng luôn user đó.
      if (error instanceof AppException && error.code === ErrorCode.AUTH_EMAIL_TAKEN) {
        const existing = await this.usersService.findByEmail(email);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async startSession(user: User, client: ClientInfo): Promise<AuthResponse> {
    const issued = await this.refreshTokenService.issueForNewSession(user.id, client);
    return this.buildResponse(user, issued);
  }

  private async buildResponse(user: User, refresh: IssuedRefreshToken): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const accessExpiresAt = new Date(Date.now() + this.config.accessTtlSeconds * 1000);
    return {
      accessToken,
      accessTokenExpiresAt: accessExpiresAt.toISOString(),
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.refreshTokenExpiresAt.toISOString(),
      user: toAuthUser(user),
    };
  }
}
