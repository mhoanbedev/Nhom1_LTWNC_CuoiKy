import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';
import { Job } from './job.entity';

/** Tin ứng viên đã lưu; `createdAt` là lúc lưu. Unique (candidateId, jobId): lưu lại không nhân đôi. */
@Entity('saved_jobs')
@Index('uq_saved_jobs_candidate_job', ['candidateId', 'jobId'], { unique: true })
export class SavedJob extends AppBaseEntity {
  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate?: User;

  @Index('idx_saved_jobs_job_id')
  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: Job;
}
