import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  CompanyStatus,
  type SeoPageType,
  type SitemapEntry,
  type StaticParam,
} from '@ltwnc/shared';
import { DataSource, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { PUBLIC_JOB_CONDITION, publicJobParams } from '../jobs/public-jobs.service';
import { toSitemapEntries, type TranslationRow } from './seo-entries';

/** Alias của bản ghi chính và cột sắp xếp "mới nhất" của từng loại trang. */
const PAGE = {
  job: { alias: 'job', newest: 'job.publishedAt' },
  company: { alias: 'company', newest: 'company.approvedAt' },
} as const;

/**
 * Dữ liệu SEO cho frontend (mục 9 của đặc tả): sitemap và danh sách trang build sẵn. Chỉ đọc; chỉ gồm
 * tin đang công khai (đủ 4 điều kiện isJobPublic) và công ty đã duyệt.
 */
@Injectable()
export class SeoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Mọi tin công khai (mới đăng trước) rồi mọi công ty đã duyệt (mới duyệt trước). */
  async sitemap(): Promise<SitemapEntry[]> {
    const [jobs, companies] = await Promise.all([
      this.translations('job').getRawMany<TranslationRow>(),
      this.translations('company').getRawMany<TranslationRow>(),
    ]);
    return [...toSitemapEntries('job', jobs), ...toSitemapEntries('company', companies)];
  }

  /** `limit` trang mới nhất của loại `type`, mỗi bản dịch một cặp `{ locale, slug }`. */
  async staticParams(type: SeoPageType, limit: number): Promise<StaticParam[]> {
    const { alias, newest } = PAGE[type];
    // Giới hạn theo số trang chứ không theo số dòng (mỗi trang có một hoặc hai bản dịch).
    const ids = await this.translations(type)
      .select(`${alias}.id`, 'id')
      .groupBy(`${alias}.id`)
      .orderBy(`MAX(${newest})`, 'DESC')
      .addOrderBy(`${alias}.id`, 'ASC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    if (ids.length === 0) return [];
    const rows = await this.translations(type)
      .andWhere(`${alias}.id IN (:...ids)`, { ids: ids.map((row) => row.id) })
      .getRawMany<TranslationRow>();
    return toSitemapEntries(type, rows).flatMap((entry) => entry.alternates);
  }

  /** Mỗi bản dịch một dòng (TranslationRow), trang mới nhất trước. */
  private translations(type: SeoPageType): SelectQueryBuilder<ObjectLiteral> {
    const { alias, newest } = PAGE[type];
    const builder =
      type === 'job'
        ? this.dataSource
            .getRepository(Job)
            .createQueryBuilder('job')
            .innerJoin('job.company', 'company')
            .innerJoin('job.translations', 't')
            .where(PUBLIC_JOB_CONDITION, publicJobParams())
        : this.dataSource
            .getRepository(Company)
            .createQueryBuilder('company')
            .innerJoin('company.translations', 't')
            .where('company.status = :approved', { approved: CompanyStatus.APPROVED });
    return builder
      .select(`${alias}.id`, 'id')
      .addSelect(`${alias}.updatedAt`, 'updatedAt')
      .addSelect('t.locale', 'locale')
      .addSelect('t.slug', 'slug')
      .addSelect('t.updatedAt', 'translationUpdatedAt')
      .orderBy(newest, 'DESC')
      .addOrderBy(`${alias}.id`, 'ASC');
  }
}
