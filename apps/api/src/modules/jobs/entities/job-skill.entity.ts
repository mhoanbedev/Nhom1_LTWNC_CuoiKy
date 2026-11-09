import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Skill } from '../../meta/entities/skill.entity';
import { Job } from './job.entity';

/** Kỹ năng của tin; phân biệt bắt buộc và ưu tiên để tính độ khớp (mục 5.7 của đặc tả). */
@Entity('job_skills')
@Index('uq_job_skills_job_skill', ['jobId', 'skillId'], { unique: true })
export class JobSkill extends AppBaseEntity {
  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, (job) => job.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  /** Index riêng để lọc tin theo kỹ năng (`/jobs?skills[]=`). */
  @Index('idx_job_skills_skill_id')
  @Column({ type: 'uuid' })
  skillId: string;

  /** Không cho xóa kỹ năng đang được tin dùng. */
  @ManyToOne(() => Skill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'skill_id' })
  skill?: Skill;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;
}
