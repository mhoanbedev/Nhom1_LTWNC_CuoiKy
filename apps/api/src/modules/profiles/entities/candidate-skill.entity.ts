import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Skill } from '../../meta/entities/skill.entity';
import { CandidateProfile } from './candidate-profile.entity';

/** Kỹ năng của ứng viên kèm mức tự đánh giá; dùng tính độ khớp với tin (mục 5.7). */
@Entity('candidate_skills')
@Index('uq_candidate_skills_profile_skill', ['profileId', 'skillId'], { unique: true })
export class CandidateSkill extends AppBaseEntity {
  @Column({ type: 'uuid' })
  profileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: CandidateProfile;

  @Index('idx_candidate_skills_skill_id')
  @Column({ type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'skill_id' })
  skill?: Skill;

  /** 1 (mới học) đến 5 (thành thạo). */
  @Column({ type: 'smallint' })
  level: number;
}
