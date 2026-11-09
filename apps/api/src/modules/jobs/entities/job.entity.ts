import { CURRENCIES, JobStatus, WorkMode, type Currency } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Company } from '../../companies/entities/company.entity';
import { Location } from '../../meta/entities/location.entity';
import { JobSkill } from './job-skill.entity';
import { JobTranslation } from './job-translation.entity';

@Entity('jobs')
/** Lọc tin công khai: PUBLISHED, không ẩn, còn hạn (mục 4 của đặc tả). */
@Index('idx_jobs_status_hidden_expires', ['status', 'isHidden', 'expiresAt'])
export class Job extends AppBaseEntity {
  /** 6 ký tự a-z0-9, gắn ở cuối slug mọi ngôn ngữ; tìm tin công khai theo cột này. */
  @Index('uq_jobs_short_id', { unique: true })
  @Column({ type: 'varchar', length: 12 })
  shortId: string;

  @Index('idx_jobs_company_id')
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({
    type: 'enum',
    enum: Object.values(JobStatus),
    enumName: 'job_status',
    default: JobStatus.DRAFT,
  })
  status: JobStatus;

  /** Admin ẩn tin là cờ riêng, để bỏ ẩn thì tin về lại trạng thái cũ. */
  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  hiddenReason: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(WorkMode),
    enumName: 'work_mode',
    default: WorkMode.ONSITE,
  })
  workMode: WorkMode;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: 'integer', nullable: true })
  salaryMin: number | null;

  @Column({ type: 'integer', nullable: true })
  salaryMax: number | null;

  @Column({ type: 'enum', enum: CURRENCIES, enumName: 'currency', default: 'VND' })
  currency: Currency;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'location_id' })
  location?: Location | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'smallint', default: 1 })
  quantity: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => JobTranslation, (translation) => translation.job)
  translations?: JobTranslation[];

  @OneToMany(() => JobSkill, (skill) => skill.job)
  skills?: JobSkill[];
}
