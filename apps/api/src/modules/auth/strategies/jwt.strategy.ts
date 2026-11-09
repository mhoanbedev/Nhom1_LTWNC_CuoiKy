import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ErrorCode, UserStatus } from '@ltwnc/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppException } from '../../../common/exceptions/app.exception';
import type { RequestUser } from '../../../common/types/request-user';
import { jwtConfig } from '../../../config/jwt.config';
import { toRequestUser } from '../../users/user.mapper';
import { UsersService } from '../../users/users.service';
import { isJwtPayload } from '../jwt-payload';

/**
 * Xác thực access token trong header `Authorization: Bearer <token>`.
 * Luôn đọc user từ DB: user bị xóa thì 401, bị khóa thì 403 dù token còn hạn,
 * đổi mật khẩu thì token cấp trước đó hết hiệu lực; role lấy từ DB chứ không tin payload.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.accessSecret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: unknown): Promise<RequestUser> {
    if (!isJwtPayload(payload)) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    if (user.status === UserStatus.LOCKED) throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED);

    // iat tính bằng giây; so với mốc đổi mật khẩu làm tròn xuống giây để token cấp ngay sau khi đổi vẫn hợp lệ.
    if (
      user.passwordChangedAt &&
      payload.iat !== undefined &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    }

    return toRequestUser(user);
  }
}
