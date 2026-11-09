import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JobStatus, RevalidateTag } from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { RevalidateService } from '../../infrastructure/revalidate/revalidate.service';
import { Job } from './entities/job.entity';

/**
 * Đóng tin đã quá hạn (mục 4 của đặc tả: "hết hạn" không phải trạng thái riêng, cron chuyển sang
 * CLOSED). API công khai vốn đã ẩn tin quá hạn nhờ lọc `expiresAt > now`; việc đóng giúp dashboard
 * nhà tuyển dụng đúng trạng thái và báo Next làm mới trang tin, sitemap.
 */
@Injectable()
export class JobExpiryService {
  private readonly logger = new Logger(JobExpiryService.name);

  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly revalidate: RevalidateService,
  ) {}

  /** Một câu UPDATE cho mọi tin quá hạn; trả id các tin vừa đóng. Chạy lại không đóng trùng. */
  async closeExpired(now = new Date()): Promise<string[]> {
    const result = await this.jobs
      .createQueryBuilder()
      .update(Job)
      .set({ status: JobStatus.CLOSED, closedAt: now })
      .where('status = :published', { published: JobStatus.PUBLISHED })
      .andWhere('expires_at <= :now', { now })
      .returning(['id', 'companyId'])
      .execute();
    const closed = (result.raw as { id: string; company_id: string }[]) ?? [];
    if (closed.length === 0) return [];

    this.logger.log(`Đã đóng ${closed.length} tin hết hạn`);
    this.revalidate.notify([
      ...closed.flatMap((row) => [
        RevalidateTag.job(row.id),
        RevalidateTag.company(row.company_id),
      ]),
      RevalidateTag.JOBS_LIST,
      RevalidateTag.SITEMAP,
    ]);
    return closed.map((row) => row.id);
  }
}
