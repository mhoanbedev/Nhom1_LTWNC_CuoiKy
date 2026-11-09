import { ApplicationStatus, type ProfileSnapshot } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { CvFile } from '../../cvs/entities/cv-file.entity';
import { Job } from '../../jobs/entities/job.entity';
import { User } from '../../users/entities/user.entity';
import { ApplicationNote } from './application-note.entity';
import { ApplicationStatusHistory } from './application-status-history.entity';

/**
 * Đơn ứng tuyển (mục 5.3 của đặc tả). Unique (jobId, candidateId): mỗi ứng viên nộp mỗi tin một
 * lần, kể cả khi đã rút; DB chặn luôn trường hợp bấm nộp hai lần cùng lúc.
 * Khóa ngoại tới tin và CV là NO ACTION: không xóa được tin hay CV đang có đơn trỏ tới (kiểm ở cuối
 * câu lệnh, nên xóa user kéo theo cả đơn trong cùng một lệnh vẫn được).
 */
@Entity('applications')
@Index('uq_applications_job_candidate', ['jobId', 'candidateId'], { unique: true })
@Index('idx_applications_job_status', ['jobId', 'status'])
export class Application extends AppBaseEntity {
  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  @Index('idx_applications_candidate_id')
  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate?: User;

  @Column({ type: 'uuid' })
  cvFileId: string;

  @ManyToOne(() => CvFile, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'cv_file_id' })
  cvFile?: CvFile;

  @Column({ type: 'text', nullable: true })
  coverLetter: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(ApplicationStatus),
    enumName: 'application_status',
    default: ApplicationStatus.SUBMITTED,
  })
  status: ApplicationStatus;

  /** Hồ sơ tại lúc nộp; sửa hồ sơ sau đó không đổi đơn cũ. */
  @Column({ type: 'jsonb' })
  profileSnapshot: ProfileSnapshot;

  @Column({ type: 'timestamptz' })
  submittedAt: Date;

  @OneToMany(() => ApplicationStatusHistory, (row) => row.application)
  history?: ApplicationStatusHistory[];

  @OneToMany(() => ApplicationNote, (row) => row.application)
  notes?: ApplicationNote[];
}
