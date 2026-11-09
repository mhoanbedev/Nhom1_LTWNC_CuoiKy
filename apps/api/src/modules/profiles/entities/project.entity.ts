import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { CandidateProfile } from './candidate-profile.entity';

@Entity('projects')
export class Project extends AppBaseEntity {
  @Index('idx_projects_profile_id')
  @Column({ type: 'uuid' })
  profileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: CandidateProfile;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, array: true, default: () => "'{}'" })
  techStack: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null;

  /** Ngày 1 của tháng; API dùng `YYYY-MM`. */
  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;
}
