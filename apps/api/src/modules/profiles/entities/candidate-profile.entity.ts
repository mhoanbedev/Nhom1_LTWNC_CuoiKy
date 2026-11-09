import { PROFILE_STEPS, type ProfileLink, type ProfileStep } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { Location } from '../../meta/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { CandidateSkill } from './candidate-skill.entity';
import { Education } from './education.entity';
import { Project } from './project.entity';

/** Hồ sơ ứng viên, một user một hồ sơ; tạo khi lưu bước đầu tiên. */
@Entity('candidate_profiles')
export class CandidateProfile extends AppBaseEntity {
  @Index('uq_candidate_profiles_user_id', { unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 150, nullable: true })
  headline: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Cột `date`: driver pg trả chuỗi `YYYY-MM-DD`, không lệch múi giờ như Date. */
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'location_id' })
  location?: Location | null;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  /** Không đặt default ở DB (TypeORM so sai default jsonb); service luôn ghi giá trị, ít nhất `[]`. */
  @Column({ type: 'jsonb' })
  links: ProfileLink[];

  /** Các bước đã lưu ít nhất một lần (mục 5.6 của đặc tả). */
  @Column({
    type: 'enum',
    enum: PROFILE_STEPS,
    enumName: 'profile_step',
    array: true,
    default: [],
  })
  completedSteps: ProfileStep[];

  @OneToMany(() => Education, (row) => row.profile)
  education?: Education[];

  @OneToMany(() => CandidateSkill, (row) => row.profile)
  skills?: CandidateSkill[];

  @OneToMany(() => Project, (row) => row.profile)
  projects?: Project[];
}
