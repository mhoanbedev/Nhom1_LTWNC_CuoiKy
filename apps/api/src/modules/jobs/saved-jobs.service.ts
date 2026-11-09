import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  JobStatus,
  type Locale,
  type Paginated,
  type PaginationQuery,
  type SavedJobItem,
} from '@ltwnc/shared';
import { In, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { Job } from './entities/job.entity';
import { SavedJob } from './entities/saved-job.entity';
import { toPublicJobListItem } from './public-job.mapper';
import { isOpen, PUBLIC_JOB_RELATIONS } from './public-jobs.service';

/** Tin ứng viên đã lưu. PUT và DELETE idempotent: gọi lại bao nhiêu lần kết quả vẫn vậy. */
@Injectable()
export class SavedJobsService {
  constructor(
    @InjectRepository(SavedJob) private readonly savedJobs: Repository<SavedJob>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  /** Chỉ lưu được tin đang công khai; tin nháp, bị ẩn, đã đóng... trả 404. Lưu rồi thì bỏ qua. */
  async save(candidateId: string, jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job || !isOpen(job)) throw new AppException(ErrorCode.NOT_FOUND);
    await this.savedJobs
      .createQueryBuilder()
      .insert()
      .into(SavedJob)
      .values({ candidateId, jobId })
      .orIgnore()
      .execute();
  }

  async unsave(candidateId: string, jobId: string): Promise<void> {
    await this.savedJobs.delete({ candidateId, jobId });
  }

  /**
   * Lưu gần đây lên trước. Tin đã đóng hay hết hạn vẫn hiện (không nhận đơn); tin bị ẩn, về nháp
   * hay công ty bị thu hồi duyệt thì không hiện vì không còn trang công khai.
   */
  async list(
    candidateId: string,
    query: PaginationQuery,
    lang: Locale,
  ): Promise<Paginated<SavedJobItem>> {
    const builder = this.savedJobs
      .createQueryBuilder('saved')
      .select('saved.jobId', 'jobId')
      .addSelect('saved.createdAt', 'savedAt')
      .innerJoin('saved.job', 'job')
      .innerJoin('job.company', 'company')
      .where('saved.candidateId = :candidateId', { candidateId })
      .andWhere('job.status != :draft', { draft: JobStatus.DRAFT })
      .andWhere('job.isHidden = false')
      .andWhere('company.status = :approved', { approved: CompanyStatus.APPROVED });

    const total = await builder.clone().getCount();
    const { skip, take } = toSkipTake(query);
    const rows = await builder
      .orderBy('saved.createdAt', 'DESC')
      .addOrderBy('saved.id', 'ASC')
      .offset(skip)
      .limit(take)
      .getRawMany<{ jobId: string; savedAt: Date }>();

    const ids = rows.map((row) => row.jobId);
    const jobs = ids.length
      ? await this.jobs.find({ where: { id: In(ids) }, relations: PUBLIC_JOB_RELATIONS })
      : [];
    const byId = new Map(jobs.map((job) => [job.id, job]));
    const now = new Date();
    const items = rows.flatMap((row) => {
      const job = byId.get(row.jobId);
      return job
        ? [
            {
              ...toPublicJobListItem(job, lang),
              savedAt: new Date(row.savedAt).toISOString(),
              isAcceptingApplications: isOpen(job, now),
            },
          ]
        : [];
    });
    return paginate(items, total, query);
  }
}
