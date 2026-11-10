import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  isJobPublic,
  JobStatus,
  MATCH_WEIGHT,
  matchScore,
  normalizeSearchText,
  Role,
  type CompanyJobsQuery,
  type Locale,
  type Paginated,
  type PublicJobDetail,
  type PublicJobListItem,
  type PublicJobsQuery,
  type RecommendedJob,
} from '@ltwnc/shared';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import type { RequestUser } from '../../common/types/request-user';
import { Job } from './entities/job.entity';
import { SavedJob } from './entities/saved-job.entity';
import { Application } from '../applications/entities/application.entity';
import { CandidateSkill } from '../profiles/entities/candidate-skill.entity';
import { JobSkill } from './entities/job-skill.entity';
import { toPublicJobDetail, toPublicJobListItem } from './public-job.mapper';

const SHORT_ID_PATTERN = /^[a-z0-9]{6}$/;
/** search_text của bản theo `lang`, tin chưa có bản đó thì dùng bản `vi`. */
const SEARCH_TEXT = 'COALESCE(tl.search_text, tv.search_text)';
/** Số tin gợi ý tối đa (mục 5.7 của đặc tả). */
const RECOMMENDED_LIMIT = 20;
/** Trọng số của một kỹ năng tin trong SQL, khớp MATCH_WEIGHT của hàm matchScore. */
const SKILL_WEIGHT = `(CASE WHEN js.isRequired THEN ${MATCH_WEIGHT.REQUIRED} ELSE ${MATCH_WEIGHT.PREFERRED} END)`;
const SKILL_OWNED = 'js.skillId IN (:...skillIds)';

/** shortId là đoạn cuối của slug (`thuc-tap-backend-a1b2c3` → `a1b2c3`). */
export function shortIdFromSlug(slug: string): string | null {
  const last = slug.split('-').pop() ?? '';
  return SHORT_ID_PATTERN.test(last) ? last : null;
}

/** Quan hệ cần để dựng tin công khai (danh sách, chi tiết, tin đã lưu). */
export const PUBLIC_JOB_RELATIONS = {
  translations: true,
  skills: { skill: true },
  company: { translations: true },
  location: true,
} as const;
const DETAIL_RELATIONS = PUBLIC_JOB_RELATIONS;

/**
 * Điều kiện SQL của tin công khai (isJobPublic): PUBLISHED, không ẩn, còn hạn, công ty APPROVED.
 * Câu truy vấn phải đặt alias `job` cho tin và `company` cho công ty; tham số lấy từ publicJobParams.
 */
export const PUBLIC_JOB_CONDITION =
  'job.status = :published AND job.isHidden = false AND job.expiresAt > :now AND company.status = :approved';

export function publicJobParams(now = new Date()) {
  return { published: JobStatus.PUBLISHED, approved: CompanyStatus.APPROVED, now };
}

/** Tin còn trang công khai (200): không phải nháp, không bị ẩn, công ty đã duyệt. */
export function isViewable(job: Job): boolean {
  return (
    job.status !== JobStatus.DRAFT &&
    !job.isHidden &&
    job.company?.status === CompanyStatus.APPROVED
  );
}

/** Tin đang nhận đơn: công khai đủ 4 điều kiện (isJobPublic), gồm còn hạn. */
export function isOpen(job: Job, now = new Date()): boolean {
  return (
    !!job.company &&
    job.expiresAt !== null &&
    isJobPublic({ ...job, expiresAt: job.expiresAt }, job.company, now)
  );
}

/**
 * Tin công khai (mục 5.2 của đặc tả): PUBLISHED, không bị ẩn, công ty APPROVED, còn hạn.
 * Danh sách lấy hai bước: lọc, sắp xếp, phân trang lấy id; rồi nạp đủ quan hệ cho đúng các id đó
 * (tránh N+1 và tránh phân trang sai khi join nhiều dòng).
 */
@Injectable()
export class PublicJobsService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(SavedJob) private readonly savedJobs: Repository<SavedJob>,
  ) {}

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
  async detail(slug: string, lang: Locale, viewer?: RequestUser): Promise<PublicJobDetail> {
    const shortId = shortIdFromSlug(slug);
    if (!shortId) throw new AppException(ErrorCode.NOT_FOUND);
    const job = await this.jobs.findOne({ where: { shortId }, relations: DETAIL_RELATIONS });
    if (!job || !isViewable(job) || !job.translations?.some((row) => row.locale === lang)) {
      throw new AppException(ErrorCode.NOT_FOUND);
    }
    const detail = toPublicJobDetail(job, lang, { isPublic: isOpen(job) });
    // Thông tin riêng của người xem chỉ thêm cho ứng viên đã đăng nhập.
    if (viewer?.role === Role.CANDIDATE) {
      const where = { candidateId: viewer.id, jobId: job.id };
      const [isSaved, hasApplied, skillIds] = await Promise.all([
        this.savedJobs.existsBy(where),
        this.jobs.manager.existsBy(Application, where),
        this.candidateSkillIds(viewer.id),
      ]);
      const match = matchScore(skillIds, job.skills ?? []);
      Object.assign(detail, {
        isSaved,
        hasApplied,
        matchScore: match.score,
        matchedSkillIds: match.matchedSkillIds,
      });
    }
    return detail;
  }

  /**
   * Gợi ý việc (mục 5.7): tin công khai có ít nhất 1 kỹ năng trùng với hồ sơ, bỏ tin đã nộp (kể cả
   * đã rút), điểm cao trước, bằng điểm thì tin mới đăng trước; tối đa 20 tin. SQL tính điểm (chưa
   * làm tròn) chỉ để sắp xếp; điểm trả ra tính lại bằng hàm matchScore dùng chung với frontend.
   */
  async recommended(candidateId: string, lang: Locale): Promise<RecommendedJob[]> {
    const skillIds = await this.candidateSkillIds(candidateId);
    if (skillIds.length === 0) return [];
    const rows = await this.jobs
      .createQueryBuilder('job')
      .innerJoin('job.company', 'company')
      .innerJoin(JobSkill, 'js', 'js.jobId = job.id')
      .select('job.id', 'id')
      .addSelect(
        `SUM(CASE WHEN ${SKILL_OWNED} THEN ${SKILL_WEIGHT} ELSE 0 END)::numeric / SUM(${SKILL_WEIGHT})`,
        'ratio',
      )
      .where(PUBLIC_JOB_CONDITION, publicJobParams())
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = job.id AND a.candidate_id = :candidateId)',
        { candidateId },
      )
      .setParameter('skillIds', skillIds)
      .groupBy('job.id')
      .having(`COUNT(*) FILTER (WHERE ${SKILL_OWNED}) > 0`)
      .orderBy('ratio', 'DESC')
      .addOrderBy('job.publishedAt', 'DESC')
      .addOrderBy('job.id', 'ASC')
      .limit(RECOMMENDED_LIMIT)
      .getRawMany<{ id: string }>();
    const jobs = await this.loadPublicJobs(rows.map((row) => row.id));
    return jobs.map((job) => {
      const item = toPublicJobListItem(job, lang);
      const match = matchScore(skillIds, job.skills ?? []);
      const matched = new Set(match.matchedSkillIds);
      return {
        ...item,
        matchScore: match.score,
        matchedSkills: item.skills.filter((skill) => matched.has(skill.id)),
      };
    });
  }

  /** Kỹ năng trong hồ sơ ứng viên (đọc bảng của module profiles). */
  private async candidateSkillIds(candidateId: string): Promise<string[]> {
    const rows = await this.jobs.manager
      .getRepository(CandidateSkill)
      .createQueryBuilder('cs')
      .innerJoin('cs.profile', 'profile')
      .select('cs.skillId', 'skillId')
      .where('profile.userId = :candidateId', { candidateId })
      .getRawMany<{ skillId: string }>();
    return rows.map((row) => row.skillId);
  }

  /** Nạp đủ quan hệ cho các tin theo đúng thứ tự `ids` (bước 2 của danh sách hai bước). */
  private async loadPublicJobs(ids: string[]): Promise<Job[]> {
    if (ids.length === 0) return [];
    const jobs = await this.jobs.find({ where: { id: In(ids) }, relations: DETAIL_RELATIONS });
    const byId = new Map(jobs.map((job) => [job.id, job]));
    return ids.flatMap((id) => {
      const job = byId.get(id);
      return job ? [job] : [];
    });
  }

  /** Khung truy vấn tin công khai, kèm bản dịch theo `lang` (tl) và bản `vi` (tv) để tìm kiếm. */
  private publicJobs(lang: Locale): SelectQueryBuilder<Job> {
    return this.jobs
      .createQueryBuilder('job')
      .select('job.id', 'id')
      .innerJoin('job.company', 'company')
      .innerJoin('job.translations', 'tv', "tv.locale = 'vi'")
      .leftJoin('job.translations', 'tl', 'tl.locale = :lang', { lang })
      .where(PUBLIC_JOB_CONDITION, publicJobParams());
  }

  private async page(
    builder: SelectQueryBuilder<Job>,
    query: { page: number; limit: number },
    lang: Locale,
  ): Promise<Paginated<PublicJobListItem>> {
    const total = await builder.clone().orderBy().getCount();
    const { skip, take } = toSkipTake(query);
    const rows = await builder.offset(skip).limit(take).getRawMany<{ id: string }>();
    const jobs = await this.loadPublicJobs(rows.map((row) => row.id));
    return paginate(
      jobs.map((job) => toPublicJobListItem(job, lang)),
      total,
      query,
    );
  }
}
