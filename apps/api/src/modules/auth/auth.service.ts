import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ErrorCode,
  UserStatus,
  type AuthResponse,
  type AuthUser,
  type ChangePasswordInput,
  type Locale,
  type LoginInput,
  type RegisterCandidateInput,
  type UpdateMeInput,
} from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { toAuthUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
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
