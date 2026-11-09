import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  ErrorCode,
  JobStatus,
  normalizeSearchText,
  slugify,
  type CreateJobInput,
  type JobSkillInput,
  type JobTranslationInput,
  type Locale,
  type Paginated,
  type RecruiterJob,
  type RecruiterJobListItem,
  type RecruiterJobsQuery,
  type UpdateJobInput,
} from '@ltwnc/shared';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import { CompaniesService } from '../companies/companies.service';
import { JobSkill } from './entities/job-skill.entity';
import { JobTranslation } from './entities/job-translation.entity';
import { Job } from './entities/job.entity';
import { toRecruiterJob, toRecruiterJobListItem } from './job.mapper';

const SHORT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHORT_ID_LENGTH = 6;
/** Phần chữ của slug; cộng "-" và shortId vẫn vừa cột 120 ký tự. */
const SLUG_TITLE_MAX = 100;
const SLUG_FALLBACK: Record<Locale, string> = { vi: 'tin-tuyen-dung', en: 'job' };

/** 6 ký tự a-z0-9 ngẫu nhiên (36^6 ≈ 2,2 tỉ khả năng). */
export function generateShortId(): string {
  return Array.from(
    { length: SHORT_ID_LENGTH },
    () => SHORT_ID_ALPHABET[randomInt(SHORT_ID_ALPHABET.length)],
  ).join('');
}

/** Slug tin: `<tiêu đề không dấu>-<shortId>`; shortId không trùng nên slug không trùng. */
export function jobSlug(title: string, shortId: string, locale: Locale): string {
  return `${slugify(title, SLUG_TITLE_MAX) || SLUG_FALLBACK[locale]}-${shortId}`;
}

function searchTextOf(input: JobTranslationInput): string {
  return normalizeSearchText([input.title, input.description, input.requirements].join(' '));
}

/** Cột của bảng jobs có trong input (bỏ qua trường không gửi khi PATCH). */
function toColumns(input: UpdateJobInput): Partial<Job> {
  const columns: Partial<Job> = {};
  if (input.workMode !== undefined) columns.workMode = input.workMode;
  if (input.isPaid !== undefined) columns.isPaid = input.isPaid;
  if (input.salaryMin !== undefined) columns.salaryMin = input.salaryMin ?? null;
  if (input.salaryMax !== undefined) columns.salaryMax = input.salaryMax ?? null;
  if (input.currency !== undefined) columns.currency = input.currency;
  if (input.locationId !== undefined) columns.locationId = input.locationId ?? null;
  if (input.address !== undefined) columns.address = input.address ?? null;
  if (input.quantity !== undefined) columns.quantity = input.quantity;
  if (input.expiresAt !== undefined) {
    columns.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  }
  return columns;
}

/**
 * Tin tuyển phía nhà tuyển dụng. Mọi truy vấn lọc theo `companyId` của người gọi, nên tin công ty
 * khác trả 404 như không tồn tại (mục 2 của đặc tả).
 */
@Injectable()
export class RecruiterJobsService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly companiesService: CompaniesService,
  ) {}

  /** Sửa gần đây lên trước. `q` tìm trên tiêu đề, nội dung cả hai ngôn ngữ, gõ không dấu được. */
  async list(
    companyId: string | null,
    query: RecruiterJobsQuery,
  ): Promise<Paginated<RecruiterJobListItem>> {
    const builder = this.jobs
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.translations', 'translation')
      .where('job.companyId = :companyId', { companyId: requireCompany(companyId) })
      .orderBy('job.updatedAt', 'DESC')
      .addOrderBy('job.id', 'ASC');
    if (query.status) builder.andWhere('job.status = :status', { status: query.status });
    if (query.q) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM job_translations jt
          WHERE jt.job_id = job.id AND jt.search_text LIKE :q)`,
        { q: containsPattern(query.q) },
      );
    }
    const { skip, take } = toSkipTake(query);
    const [rows, total] = await builder.skip(skip).take(take).getManyAndCount();
    return paginate(rows.map(toRecruiterJobListItem), total, query);
  }

  async get(companyId: string | null, id: string): Promise<RecruiterJob> {
    return toRecruiterJob(await this.findOwned(this.dataSource.manager, companyId, id));
  }

  /** Tạo tin nháp. Công ty chưa được duyệt thì 403 COMPANY_NOT_APPROVED. */
  async create(companyId: string | null, input: CreateJobInput): Promise<RecruiterJob> {
    const ownCompanyId = requireCompany(companyId);
    await this.companiesService.assertApproved(ownCompanyId);

    const id = await this.dataSource.transaction(async (manager) => {
      const shortId = await this.uniqueShortId(manager);
      const repository = manager.getRepository(Job);
      const job = await repository.save(
        repository.create({
          companyId: ownCompanyId,
          shortId,
          status: JobStatus.DRAFT,
          ...toColumns(input),
        }),
      );
      await this.saveTranslations(manager, job, input.translations, []);
      await this.replaceSkills(manager, job.id, input.skills);
      return job.id;
    });
    return this.get(ownCompanyId, id);
  }

  /**
   * Sửa tin: gửi trường nào sửa trường đó. Tắt `isPaid` thì xóa luôn mức lương.
   * `skills` gửi lên là thay cả danh sách; `translations` gửi lên thì bỏ `en` là xóa bản en.
   */
  async update(companyId: string | null, id: string, input: UpdateJobInput): Promise<RecruiterJob> {
    await this.dataSource.transaction(async (manager) => {
      const job = await this.findOwned(manager, companyId, id);
      const columns = toColumns(input);
      if (input.isPaid === false) {
        columns.salaryMin = null;
        columns.salaryMax = null;
      }
      const merged = { ...job, ...columns };
      if (
        merged.salaryMin != null &&
        merged.salaryMax != null &&
        merged.salaryMin > merged.salaryMax
      ) {
        throw new AppException(ErrorCode.BAD_REQUEST);
      }
      if (Object.keys(columns).length > 0) await manager.getRepository(Job).update(job.id, columns);
      if (input.translations) {
        await this.saveTranslations(manager, job, input.translations, job.translations ?? []);
      }
      if (input.skills) await this.replaceSkills(manager, job.id, input.skills);
      // Sửa bản dịch hay kỹ năng cũng tính là tin vừa được sửa.
      await manager.getRepository(Job).update(job.id, { updatedAt: new Date() });
    });
    return this.get(companyId, id);
  }

  /** Chỉ xóa được bản nháp; tin đã đăng thì đóng chứ không xóa (giữ đơn ứng tuyển). */
  async remove(companyId: string | null, id: string): Promise<void> {
    const job = await this.findOwned(this.dataSource.manager, companyId, id);
    if (job.status !== JobStatus.DRAFT) {
      throw new AppException(ErrorCode.JOB_INVALID_TRANSITION);
    }
    await this.jobs.delete(job.id);
  }

  private async findOwned(
    manager: EntityManager,
    companyId: string | null,
    id: string,
  ): Promise<Job> {
    const job = await manager.getRepository(Job).findOne({
      where: { id, companyId: requireCompany(companyId) },
      relations: { translations: true, skills: true },
    });
    if (!job) throw new AppException(ErrorCode.NOT_FOUND);
    return job;
  }

  private async uniqueShortId(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shortId = generateShortId();
      if (!(await manager.getRepository(Job).existsBy({ shortId }))) return shortId;
    }
    throw new Error('Không sinh được shortId không trùng sau 5 lần thử');
  }

  /** Như công ty: bản dịch đã có thì cập nhật (giữ slug), chưa có thì tạo; bỏ `en` là xóa. */
  private async saveTranslations(
    manager: EntityManager,
    job: Job,
    input: { vi: JobTranslationInput; en?: JobTranslationInput | null },
    existing: JobTranslation[],
  ): Promise<void> {
    const repository = manager.getRepository(JobTranslation);
    const save = async (locale: Locale, translation: JobTranslationInput) => {
      const fields = {
        title: translation.title,
        description: translation.description ?? null,
        requirements: translation.requirements ?? null,
        benefits: translation.benefits ?? null,
        searchText: searchTextOf(translation),
      };
      const current = existing.find((t) => t.locale === locale);
      if (current) {
        await repository.update(current.id, fields);
      } else {
        const slug = jobSlug(translation.title, job.shortId, locale);
        await repository.insert({ jobId: job.id, locale, slug, ...fields });
      }
    };

    await save('vi', input.vi);
    if (input.en) {
      await save('en', input.en);
    } else {
      const en = existing.find((t) => t.locale === 'en');
      if (en) await repository.delete(en.id);
    }
  }

  private async replaceSkills(
    manager: EntityManager,
    jobId: string,
    skills: JobSkillInput[],
  ): Promise<void> {
    const repository = manager.getRepository(JobSkill);
    await repository.delete({ jobId });
    if (skills.length === 0) return;
    await repository.insert(
      skills.map((skill) => ({ jobId, skillId: skill.skillId, isRequired: skill.isRequired })),
    );
  }
}

/** Nhà tuyển dụng luôn có công ty (tạo cùng lúc đăng ký); thiếu là token của user không hợp lệ. */
function requireCompany(companyId: string | null): string {
  if (!companyId) throw new AppException(ErrorCode.FORBIDDEN);
  return companyId;
}
