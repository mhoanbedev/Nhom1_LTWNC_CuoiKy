import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ErrorCode } from '@ltwnc/shared';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { jwtConfig } from '../../config/jwt.config';
import { RefreshToken } from './entities/refresh-token.entity';
import { decideRefresh, generateRefreshToken, hashRefreshToken } from './refresh-token.policy';

/** Thông tin thiết bị gửi kèm, chỉ để tra cứu phiên đăng nhập. */
export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedRefreshToken {
  id: string;
  userId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

type RotateResult =
  { ok: true; issued: IssuedRefreshToken } | { ok: false; code: ErrorCode; userId?: string };

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  /** Cấp refresh token cho phiên đăng nhập mới (family mới). */
  issueForNewSession(userId: string, client: ClientInfo): Promise<IssuedRefreshToken> {
    return this.issue(this.tokens.manager, userId, randomUUID(), client);
  }

  /**
   * Đổi refresh token lấy token mới (xoay vòng). Khóa dòng token trong transaction nên hai request
   * đổi cùng một token chạy lần lượt: request sau rơi vào nhánh ân hạn thay vì bị coi là dùng lại.
   * Không ném lỗi trong transaction, vì lệnh thu hồi family khi phát hiện dùng lại phải được commit.
   */
  async rotate(token: string, client: ClientInfo): Promise<IssuedRefreshToken> {
    const now = new Date();
    const result = await this.dataSource.transaction(async (manager): Promise<RotateResult> => {
      const current = await manager.findOne(RefreshToken, {
        where: { tokenHash: hashRefreshToken(token) },
        lock: { mode: 'pessimistic_write' },
      });
      const decision = decideRefresh(current, now, this.config.refreshGraceSeconds);

      if (!current || decision === 'invalid') {
        return { ok: false, code: ErrorCode.AUTH_REFRESH_INVALID };
      }
      if (decision === 'reuse') {
        await this.revokeFamilyWith(manager, current.familyId, now);
        return { ok: false, code: ErrorCode.AUTH_REFRESH_REUSED, userId: current.userId };
      }

      const issued = await this.issue(manager, current.userId, current.familyId, client);
      if (decision === 'rotate') {
        await manager.update(RefreshToken, current.id, { revokedAt: now, replacedById: issued.id });
      }
      return { ok: true, issued };
    });

    if (result.ok) return result.issued;
    if (result.code === ErrorCode.AUTH_REFRESH_REUSED) {
      this.logger.warn(`Refresh token bị dùng lại, đã thu hồi cả phiên của user ${result.userId}`);
    }
    throw new AppException(result.code);
  }

  /** Đăng xuất phiên hiện tại: thu hồi cả family của token, chỉ khi token thuộc user này. */
  async revokeSession(token: string, userId: string): Promise<void> {
    const current = await this.tokens.findOneBy({ tokenHash: hashRefreshToken(token), userId });
    if (current) await this.revokeFamilyWith(this.tokens.manager, current.familyId, new Date());
  }

  /** Đăng xuất mọi thiết bị; cũng dùng khi đổi mật khẩu hoặc bị admin khóa. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Xóa token đã hết hạn quá `olderThanSeconds`; cron chạy hằng ngày. Trả số dòng đã xóa. */
  async deleteExpired(olderThanSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    const result = await this.tokens.delete({ expiresAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }

  private async issue(
    manager: EntityManager,
    userId: string,
    familyId: string,
    client: ClientInfo,
  ): Promise<IssuedRefreshToken> {
    const id = randomUUID();
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);
    await manager.insert(RefreshToken, {
      id,
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
      userAgent: client.userAgent?.slice(0, 512) ?? null,
      ip: client.ip?.slice(0, 64) ?? null,
    });
    return { id, userId, refreshToken, refreshTokenExpiresAt: expiresAt };
  }

  private async revokeFamilyWith(
    manager: EntityManager,
    familyId: string,
    now: Date,
  ): Promise<void> {
    await manager.update(RefreshToken, { familyId, revokedAt: IsNull() }, { revokedAt: now });
  }
}
