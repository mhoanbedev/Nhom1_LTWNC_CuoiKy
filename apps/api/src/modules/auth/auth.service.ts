import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ErrorCode,
  UserStatus,
  type AuthResponse,
  type Locale,
  type LoginInput,
  type RegisterCandidateInput,
} from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import type { User } from '../users/entities/user.entity';
import { toAuthUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt-payload';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  /** Đăng ký ứng viên rồi đăng nhập luôn. Ngôn ngữ ưa thích lấy theo ngôn ngữ lúc đăng ký. */
  async registerCandidate(input: RegisterCandidateInput, locale: Locale): Promise<AuthResponse> {
    if (await this.usersService.existsByEmail(input.email)) {
      throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }
    const user = await this.usersService.createCandidate({
      email: input.email,
      name: input.name,
      passwordHash: await this.passwordService.hash(input.password),
      preferredLocale: locale,
    });
    return this.issueTokens(user);
  }

  /**
   * Email không tồn tại và sai mật khẩu trả cùng một lỗi, để không lộ email nào đã đăng ký.
   * Tài khoản khóa chỉ báo sau khi mật khẩu đúng.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(input.email);
    if (!user?.passwordHash) {
      await this.passwordService.verifyDummy(input.password);
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const valid = await this.passwordService.verify(user.passwordHash, input.password);
    if (!valid) throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    if (user.status === UserStatus.LOCKED) throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);

    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const expiresAt = new Date(Date.now() + this.config.accessTtlSeconds * 1000);
    return {
      accessToken,
      accessTokenExpiresAt: expiresAt.toISOString(),
      user: toAuthUser(user),
    };
  }
}
