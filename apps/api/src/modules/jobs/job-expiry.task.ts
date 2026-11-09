import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobExpiryService } from './job-expiry.service';

/** Cron 0h05 mỗi ngày (giờ Việt Nam): đóng tin đã quá hạn nhận hồ sơ. */
@Injectable()
export class JobExpiryTask {
  constructor(private readonly jobExpiryService: JobExpiryService) {}

  @Cron('5 0 * * *', { name: 'job-expiry', timeZone: 'Asia/Ho_Chi_Minh' })
  async run(): Promise<void> {
    await this.jobExpiryService.closeExpired();
  }
}
