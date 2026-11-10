import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ErrorCode, UserStatus, type AdminUser } from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Admin khóa/mở khóa tài khoản. Nằm ở module auth vì khóa phải thu hồi refresh token (bảng của
 * auth); trạng thái user vẫn ghi qua UsersService.
 */
@Injectable()
export class AccountLockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /**
   * Khóa và thu hồi mọi refresh token trong cùng transaction: không refresh được nữa, còn access
   * token đang còn hạn bị JwtStrategy chặn ngay (403 AUTH_ACCOUNT_LOCKED) vì nó đọc trạng thái từ DB.
   * Không khóa được chính mình (hệ thống chỉ có 1 admin). Khóa lại tài khoản đã khóa thì giữ nguyên.
   */
  async lock(adminId: string, userId: string): Promise<AdminUser> {
    if (adminId === userId) throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
    await this.dataSource.transaction(async (manager) => {
      await this.users.setStatus(userId, UserStatus.LOCKED, manager);
      await this.refreshTokens.revokeAllForUser(userId, manager);
    });
    return this.users.findForAdmin(userId);
  }

  /** Mở khóa: đăng nhập lại được (phiên cũ đã bị thu hồi lúc khóa). Idempotent. */
  async unlock(userId: string): Promise<AdminUser> {
    await this.dataSource.transaction((manager) =>
      this.users.setStatus(userId, UserStatus.ACTIVE, manager),
    );
    return this.users.findForAdmin(userId);
  }
}
