import { LOCALES, type Locale } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Company } from './company.entity';

/**
 * Nội dung công ty theo ngôn ngữ (mục 3 của đặc tả). Bản `vi` bắt buộc, `en` tùy chọn.
 * Index trigram trên `search_text` viết tay trong migration (TypeORM không khai được),
 * `synchronize: false` để migration:generate không xóa nó.
 */
@Entity('company_translations')
@Index('uq_company_translations_company_locale', ['companyId', 'locale'], { unique: true })
@Index('uq_company_translations_locale_slug', ['locale', 'slug'], { unique: true })
@Index('idx_company_translations_search_trgm', { synchronize: false })
export class CompanyTranslation extends AppBaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ type: 'enum', enum: LOCALES, enumName: 'locale' })
  locale: Locale;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Sinh một lần khi tạo bản dịch; sửa tên không đổi slug để URL đã index không chết. */
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  /** Markdown. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Tên đã bỏ dấu, viết thường, để tìm không dấu (normalizeSearchText). */
  @Column({ type: 'text' })
  searchText: string;
}
