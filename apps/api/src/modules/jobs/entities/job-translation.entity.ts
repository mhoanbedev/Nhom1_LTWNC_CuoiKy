import { LOCALES, type Locale } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Job } from './job.entity';

/**
 * Nội dung tin theo ngôn ngữ (Markdown). Index trigram trên `search_text` viết tay trong migration,
 * `synchronize: false` để migration:generate không xóa nó.
 */
@Entity('job_translations')
@Index('uq_job_translations_job_locale', ['jobId', 'locale'], { unique: true })
@Index('uq_job_translations_locale_slug', ['locale', 'slug'], { unique: true })
@Index('idx_job_translations_search_trgm', { synchronize: false })
export class JobTranslation extends AppBaseEntity {
  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, (job) => job.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  @Column({ type: 'enum', enum: LOCALES, enumName: 'locale' })
  locale: Locale;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** `<tiêu đề không dấu>-<shortId>`; sinh một lần, sửa tiêu đề không đổi slug. */
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  @Column({ type: 'text', nullable: true })
  benefits: string | null;

  /** Tiêu đề và nội dung đã bỏ dấu, viết thường (normalizeSearchText), để tìm không dấu. */
  @Column({ type: 'text' })
  searchText: string;
}
