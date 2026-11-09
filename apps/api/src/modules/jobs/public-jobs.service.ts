import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  isJobPublic,
  JobStatus,
  normalizeSearchText,
  type CompanyJobsQuery,
  type Locale,
  type Paginated,
  type PublicJobDetail,
  type PublicJobListItem,
  type PublicJobsQuery,
} from '@ltwnc/shared';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import { Job } from './entities/job.entity';
import { toPublicJobDetail, toPublicJobListItem } from './public-job.mapper';

const SHORT_ID_PATTERN = /^[a-z0-9]{6}$/;
/** search_text của bản theo `lang`, tin chưa có bản đó thì dùng bản `vi`. */
const SEARCH_TEXT = 'COALESCE(tl.search_text, tv.search_text)';

/** shortId là đoạn cuối của slug (`thuc-tap-backend-a1b2c3` → `a1b2c3`). */
export function shortIdFromSlug(slug: string): string | null {
  const last = slug.split('-').pop() ?? '';
  return SHORT_ID_PATTERN.test(last) ? last : null;
}

const DETAIL_RELATIONS = {
  translations: true,
  skills: { skill: true },
  company: { translations: true },
  location: true,
} as const;

/**
 * Tin công khai (mục 5.2 của đặc tả): PUBLISHED, không bị ẩn, công ty APPROVED, còn hạn.
 * Danh sách lấy hai bước: lọc, sắp xếp, phân trang lấy id; rồi nạp đủ quan hệ cho đúng các id đó
 * (tránh N+1 và tránh phân trang sai khi join nhiều dòng).
 */
@Injectable()
export class PublicJobsService {
  constructor(@InjectRepository(Job) private readonly jobs: Repository<Job>) {}

  async list(query: PublicJobsQuery, lang: Locale): Promise<Paginated<PublicJobListItem>> {
    const builder = this.publicJobs(lang);
    if (query.q) {
      builder.andWhere(`${SEARCH_TEXT} LIKE :pattern`, { pattern: containsPattern(query.q) });
    }
    if (query.skills?.length) {
      builder.andWhere(
        'EXISTS (SELECT 1 FROM job_skills js WHERE js.job_id = job.id AND js.skill_id IN (:...skills))',
        { skills: query.skills },
      );
    }
    if (query.locationId)
      builder.andWhere('job.locationId = :locationId', { locationId: query.locationId });
    if (query.workMode) builder.andWhere('job.workMode = :workMode', { workMode: query.workMode });
    if (query.isPaid !== undefined)
      builder.andWhere('job.isPaid = :isPaid', { isPaid: query.isPaid });

    const sort = query.sort ?? (query.q ? 'relevance' : 'newest');
    if (sort === 'relevance' && query.q) {
      builder
        .addSelect(`similarity(${SEARCH_TEXT}, :term)`, 'score')
        .setParameter('term', normalizeSearchText(query.q))
        .orderBy('score', 'DESC')
        .addOrderBy('job.publishedAt', 'DESC');
    } else if (sort === 'deadline') {
      builder.orderBy('job.expiresAt', 'ASC');
    } else {
      builder.orderBy('job.publishedAt', 'DESC');
    }
    builder.addOrderBy('job.id', 'ASC');
    return this.page(builder, query, lang);
  }

  /** Tin công khai của một công ty (trang công ty), mới đăng lên trước. */
  async listByCompany(
    companyId: string,
    query: CompanyJobsQuery,
    lang: Locale,
  ): Promise<Paginated<PublicJobListItem>> {
    const builder = this.publicJobs(lang)
      .andWhere('job.companyId = :companyId', { companyId })
      .orderBy('job.publishedAt', 'DESC')
      .addOrderBy('job.id', 'ASC');
    return this.page(builder, query, lang);
  }

  /**
   * Chi tiết theo slug (tìm bằng shortId ở cuối). Ba trường hợp theo bảng 5.2 của đặc tả:
   * công khai → 200, indexable; đã đóng hay hết hạn (không ẩn) → 200, noindex, không nhận đơn;
   * nháp, bị ẩn, công ty chưa duyệt, hoặc không có bản theo `lang` → 404.
   */
  async detail(slug: string, lang: Locale): Promise<PublicJobDetail> {
    const shortId = shortIdFromSlug(slug);
    if (!shortId) throw new AppException(ErrorCode.NOT_FOUND);
    const job = await this.jobs.findOne({ where: { shortId }, relations: DETAIL_RELATIONS });
    const company = job?.company;
    if (
      !job ||
      !company ||
      job.status === JobStatus.DRAFT ||
      job.isHidden ||
      company.status !== CompanyStatus.APPROVED ||
      !job.translations?.some((row) => row.locale === lang)
    ) {
      throw new AppException(ErrorCode.NOT_FOUND);
    }
    const isPublic =
      job.expiresAt !== null &&
      isJobPublic({ ...job, expiresAt: job.expiresAt }, company, new Date());
    return toPublicJobDetail(job, lang, { isPublic });
  }

  /** Khung truy vấn tin công khai, kèm bản dịch theo `lang` (tl) và bản `vi` (tv) để tìm kiếm. */
  private publicJobs(lang: Locale): SelectQueryBuilder<Job> {
    return this.jobs
      .createQueryBuilder('job')
      .select('job.id', 'id')
      .innerJoin('job.company', 'company')
      .innerJoin('job.translations', 'tv', "tv.locale = 'vi'")
      .leftJoin('job.translations', 'tl', 'tl.locale = :lang', { lang })
      .where('job.status = :published', { published: JobStatus.PUBLISHED })
      .andWhere('job.isHidden = false')
      .andWhere('job.expiresAt > :now', { now: new Date() })
      .andWhere('company.status = :approved', { approved: CompanyStatus.APPROVED });
  }

  private async page(
    builder: SelectQueryBuilder<Job>,
    query: { page: number; limit: number },
    lang: Locale,
  ): Promise<Paginated<PublicJobListItem>> {
    const total = await builder.clone().orderBy().getCount();
    const { skip, take } = toSkipTake(query);
    const rows = await builder.offset(skip).limit(take).getRawMany<{ id: string }>();
    const ids = rows.map((row) => row.id);
    const jobs = ids.length
      ? await this.jobs.find({ where: { id: In(ids) }, relations: DETAIL_RELATIONS })
      : [];
    const byId = new Map(jobs.map((job) => [job.id, job]));
    const ordered = ids.flatMap((id) => {
      const job = byId.get(id);
      return job ? [toPublicJobListItem(job, lang)] : [];
    });
    return paginate(ordered, total, query);
  }
}
