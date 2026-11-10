import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  ErrorCode,
  NotificationType,
  type AdminJob,
  type AdminJobsQuery,
  type Paginated,
} from '@ltwnc/shared';
import { DataSource, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { localizedText } from '../../common/utils/localized-text';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import { RevalidateService } from '../../infrastructure/revalidate/revalidate.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Job } from './entities/job.entity';
import { toAdminJob } from './job.mapper';
import { jobTags } from './recruiter-jobs.service';

/**
 * Kiểm soát tin phía admin (mục 5.2 của đặc tả). Ẩn là cờ `isHidden` riêng, không đổi `status`,
 * nên bỏ ẩn thì tin về đúng trạng thái cũ.
 */
@Injectable()
export class JobsAdminService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly revalidate: RevalidateService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Mọi trạng thái, kể cả nháp; mới tạo lên trước. `q` tìm trên tiêu đề cả hai ngôn ngữ. */
  async list(query: AdminJobsQuery): Promise<Paginated<AdminJob>> {
    const builder = this.jobs
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.translations', 'translation')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('company.translations', 'companyTranslation')
      .orderBy('job.createdAt', 'DESC')
      .addOrderBy('job.id', 'ASC');
    if (query.status) builder.andWhere('job.status = :status', { status: query.status });
    if (query.hidden !== undefined) {
      builder.andWhere('job.isHidden = :hidden', { hidden: query.hidden });
    }
    if (query.q) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM job_translations jt
          WHERE jt.job_id = job.id AND jt.search_text LIKE :q)`,
        { q: containsPattern(query.q) },
      );
    }
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await builder.skip(skip).take(take).getManyAndCount();
    return paginate(rows.map(toAdminJob), total, query);
  }

  /**
   * Ẩn tin kèm lý do, chủ tin nhận JOB_HIDDEN (cùng transaction). Tin đang ẩn thì giữ nguyên lý do
   * cũ và không báo lại (idempotent); muốn đổi lý do thì bỏ ẩn rồi ẩn lại. Điều kiện
   * `isHidden = false` nằm ngay trong UPDATE nên hai request ẩn cùng lúc chỉ một cái gửi thông báo.
   */
  async hide(id: string, reason: string): Promise<AdminJob> {
    const job = await this.findById(id);
    const ownerId = job.company?.ownerId;
    // Tin luôn thuộc một công ty; thiếu là dữ liệu hỏng.
    if (!ownerId) throw new AppException(ErrorCode.INTERNAL_ERROR);
    const changed = await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(Job)
        .update({ id, isHidden: false }, { isHidden: true, hiddenReason: reason });
      if (!result.affected) return false;
      await this.notifications.create(manager, ownerId, {
        type: NotificationType.JOB_HIDDEN,
        data: { jobId: id, jobTitle: localizedText(job.translations, 'title'), reason },
      });
      return true;
    });
    if (changed) this.revalidate.notify(jobTags(job));
    return toAdminJob(await this.findById(id));
  }

  /** Bỏ ẩn: tin về trạng thái cũ, xóa lý do. Tin không bị ẩn thì giữ nguyên (idempotent). */
  async unhide(id: string): Promise<AdminJob> {
    const job = await this.findById(id);
    const result = await this.jobs.update(
      { id, isHidden: true },
      { isHidden: false, hiddenReason: null },
    );
    if (result.affected) this.revalidate.notify(jobTags(job));
    return toAdminJob(await this.findById(id));
  }

  private async findById(id: string): Promise<Job> {
    const job = await this.jobs.findOne({
      where: { id },
      relations: { translations: true, company: { translations: true } },
    });
    if (!job) throw new AppException(ErrorCode.NOT_FOUND);
    return job;
  }
}
