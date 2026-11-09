import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompanyStatus,
  ErrorCode,
  JobStatus,
  type Locale,
  type Paginated,
  type PublicCompaniesQuery,
  type PublicCompanyDetail,
  type PublicCompanyListItem,
} from '@ltwnc/shared';
import { In, Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { renderMarkdown } from '../../common/utils/markdown';
import { paginate, toSkipTake } from '../../common/utils/paginate';
import { containsPattern } from '../../common/utils/search';
import { localizedName } from '../meta/entities/localized-name.entity';
import { CompanyTranslation } from './entities/company-translation.entity';
import { Company } from './entities/company.entity';

const RELATIONS = { translations: true, industry: true, location: true } as const;

/** Trang công ty công khai (mục 5.1): chỉ công ty APPROVED, còn lại 404. */
@Injectable()
export class CompaniesPublicService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(CompanyTranslation)
    private readonly translations: Repository<CompanyTranslation>,
  ) {}

  /** Công ty duyệt gần đây lên trước. `q` tìm theo tên (bản theo `lang`, thiếu thì bản vi). */
  async list(query: PublicCompaniesQuery, lang: Locale): Promise<Paginated<PublicCompanyListItem>> {
    const builder = this.companies
      .createQueryBuilder('company')
      .select('company.id', 'id')
      .innerJoin('company.translations', 'tv', "tv.locale = 'vi'")
      .leftJoin('company.translations', 'tl', 'tl.locale = :lang', { lang })
      .where('company.status = :approved', { approved: CompanyStatus.APPROVED });
    if (query.q) {
      builder.andWhere('COALESCE(tl.search_text, tv.search_text) LIKE :pattern', {
        pattern: containsPattern(query.q),
      });
    }
    if (query.industryId)
      builder.andWhere('company.industryId = :industryId', { industryId: query.industryId });
    if (query.locationId)
      builder.andWhere('company.locationId = :locationId', { locationId: query.locationId });

    const total = await builder.clone().getCount();
    const { skip, take } = toSkipTake(query);
    const rows = await builder
      .orderBy('company.approvedAt', 'DESC')
      .addOrderBy('company.id', 'ASC')
      .offset(skip)
      .limit(take)
      .getRawMany<{ id: string }>();
    const ids = rows.map((row) => row.id);
    const companies = ids.length
      ? await this.companies.find({ where: { id: In(ids) }, relations: RELATIONS })
      : [];
    const counts = await this.openJobCounts(ids);
    const byId = new Map(companies.map((company) => [company.id, company]));
    const items = ids.flatMap((id) => {
      const company = byId.get(id);
      return company ? [this.toListItem(company, lang, counts.get(id) ?? 0)] : [];
    });
    return paginate(items, total, query);
  }

  /**
   * Trang công ty theo slug của bất kỳ ngôn ngữ nào. Chưa duyệt hoặc không có bản theo `lang`
   * thì 404 (không lấy bản vi thay). Trả `canonicalSlug` để frontend redirect khi slug lệch.
   */
  async detail(slug: string, lang: Locale): Promise<PublicCompanyDetail> {
    const company = await this.findApprovedBySlug(slug, lang);
    const translation = company.translations?.find((row) => row.locale === lang);
    if (!translation) throw new AppException(ErrorCode.NOT_FOUND);
    const counts = await this.openJobCounts([company.id]);
    return {
      ...this.toListItem(company, lang, counts.get(company.id) ?? 0),
      canonicalSlug: translation.slug,
      alternates: (company.translations ?? [])
        .map((row) => ({ locale: row.locale, slug: row.slug }))
        .sort((a, b) => a.locale.localeCompare(b.locale)),
      description: translation.description,
      descriptionHtml: renderMarkdown(translation.description),
      website: company.website,
      size: company.size,
      address: company.address,
    };
  }

  /** Id công ty đã duyệt theo slug (bất kỳ ngôn ngữ nào), dùng cho `/companies/:slug/jobs`. */
  async approvedIdBySlug(slug: string, lang: Locale): Promise<string> {
    return (await this.findApprovedBySlug(slug, lang)).id;
  }

  /**
   * Slug chỉ unique trong một ngôn ngữ: slug vi của công ty A có thể trùng slug en của công ty B.
   * Ưu tiên bản khớp đúng `lang`, không có mới lấy bản ngôn ngữ khác.
   */
  private async findApprovedBySlug(slug: string, lang: Locale): Promise<Company> {
    const matches = await this.translations.find({
      where: { slug },
      select: { companyId: true, locale: true },
    });
    const match = matches.find((row) => row.locale === lang) ?? matches[0];
    const company = match
      ? await this.companies.findOne({ where: { id: match.companyId }, relations: RELATIONS })
      : null;
    if (!company || company.status !== CompanyStatus.APPROVED) {
      throw new AppException(ErrorCode.NOT_FOUND);
    }
    return company;
  }

  /** Số tin đang công khai của từng công ty, một truy vấn cho cả trang. */
  private async openJobCounts(companyIds: string[]): Promise<Map<string, number>> {
    if (companyIds.length === 0) return new Map();
    const rows = await this.companies.manager
      .createQueryBuilder()
      .select('job.company_id', 'companyId')
      .addSelect('COUNT(*)::int', 'count')
      .from('jobs', 'job')
      .where('job.company_id IN (:...companyIds)', { companyIds })
      .andWhere('job.status = :published', { published: JobStatus.PUBLISHED })
      .andWhere('job.is_hidden = false')
      .andWhere('job.expires_at > :now', { now: new Date() })
      .groupBy('job.company_id')
      .getRawMany<{ companyId: string; count: number }>();
    return new Map(rows.map((row) => [row.companyId, row.count]));
  }

  private toListItem(company: Company, lang: Locale, openJobCount: number): PublicCompanyListItem {
    const translation =
      company.translations?.find((row) => row.locale === lang) ??
      company.translations?.find((row) => row.locale === 'vi');
    if (!translation) throw new AppException(ErrorCode.INTERNAL_ERROR);
    return {
      id: company.id,
      locale: translation.locale,
      slug: translation.slug,
      name: translation.name,
      logoUrl: company.logoUrl,
      industry: company.industry
        ? { id: company.industry.id, name: localizedName(company.industry, lang) }
        : null,
      location: company.location
        ? { id: company.location.id, name: localizedName(company.location, lang) }
        : null,
      openJobCount,
    };
  }
}
