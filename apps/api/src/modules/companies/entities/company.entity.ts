import { COMPANY_SIZES, CompanyStatus, type CompanySize } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Industry } from '../../meta/entities/industry.entity';
import { Location } from '../../meta/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { CompanyTranslation } from './company-translation.entity';

@Entity('companies')
export class Company extends AppBaseEntity {
  /** Nhà tuyển dụng sở hữu. Mỗi nhà tuyển dụng đúng một công ty. */
  @Index('uq_companies_owner_id', { unique: true })
  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: User;

  @Index('idx_companies_status')
  @Column({
    type: 'enum',
    enum: Object.values(CompanyStatus),
    enumName: 'company_status',
    default: CompanyStatus.PENDING,
  })
  status: CompanyStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectReason: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  /** public_id trên Cloudinary, để xóa logo cũ khi đổi logo. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  logoPublicId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'enum', enum: COMPANY_SIZES, enumName: 'company_size', nullable: true })
  size: CompanySize | null;

  @Column({ type: 'uuid', nullable: true })
  industryId: string | null;

  @ManyToOne(() => Industry, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'industry_id' })
  industry?: Industry | null;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'location_id' })
  location?: Location | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @OneToMany(() => CompanyTranslation, (translation) => translation.company)
  translations?: CompanyTranslation[];
}
