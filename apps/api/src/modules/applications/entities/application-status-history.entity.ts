import { ApplicationStatus } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';
import { Application } from './application.entity';

/** Lịch sử trạng thái đơn: mỗi lần chuyển một dòng; `createdAt` là lúc chuyển. */
@Entity('application_status_histories')
export class ApplicationStatusHistory extends AppBaseEntity {
  @Index('idx_application_status_histories_application_id')
  @Column({ type: 'uuid' })
  applicationId: string;

  @ManyToOne(() => Application, (application) => application.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  /** null: dòng đầu tiên lúc nộp đơn. */
  @Column({
    type: 'enum',
    enum: Object.values(ApplicationStatus),
    enumName: 'application_status',
    nullable: true,
  })
  fromStatus: ApplicationStatus | null;

  @Column({ type: 'enum', enum: Object.values(ApplicationStatus), enumName: 'application_status' })
  toStatus: ApplicationStatus;

  /** Người đổi; user bị xóa thì để null nhưng vẫn giữ lịch sử. */
  @Column({ type: 'uuid', nullable: true })
  changedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy?: User | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
