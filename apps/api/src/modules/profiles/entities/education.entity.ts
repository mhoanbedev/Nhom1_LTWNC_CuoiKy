import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { CandidateProfile } from './candidate-profile.entity';

/** numeric của Postgres về JS là chuỗi; đổi lại thành số. */
const numericToNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('educations')
export class Education extends AppBaseEntity {
  @Index('idx_educations_profile_id')
  @Column({ type: 'uuid' })
  profileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.education, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: CandidateProfile;

  @Column({ type: 'varchar', length: 200 })
  school: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  major: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  degree: string | null;

  /** Lưu ngày 1 của tháng (`YYYY-MM-01`); API nhận và trả `YYYY-MM`. */
  @Column({ type: 'date' })
  startDate: string;

  /** null: đang học. */
  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true, transformer: numericToNumber })
  gpa: number | null;
}
