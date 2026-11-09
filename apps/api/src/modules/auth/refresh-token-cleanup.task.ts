import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenService } from './refresh-token.service';

/** Cron hằng ngày: xóa refresh token đã hết hạn quá 7 ngày (mục 6 của đặc tả). */
@Injectable()
export class RefreshTokenCleanupTask {
  private readonly logger = new Logger(RefreshTokenCleanupTask.name);
  private static readonly KEEP_EXPIRED_SECONDS = 7 * 24 * 3600;

  constructor(private readonly refreshTokenService: RefreshTokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'refresh-token-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async run(): Promise<void> {
    const deleted = await this.refreshTokenService.deleteExpired(
      RefreshTokenCleanupTask.KEEP_EXPIRED_SECONDS,
    );
    if (deleted > 0) this.logger.log(`Đã xóa ${deleted} refresh token hết hạn`);
  }
}
