import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';
import { Application } from './application.entity';

/**
 * Ghi chú nội bộ của nhà tuyển dụng về một đơn (mục 4 của đặc tả). Ứng viên không bao giờ thấy.
 * Chỉ thêm, không sửa, không xóa, như nhật ký làm việc.
 */
@Entity('application_notes')
export class ApplicationNote extends AppBaseEntity {
  @Index('idx_application_notes_application_id')
  @Column({ type: 'uuid' })
  applicationId: string;

  @ManyToOne(() => Application, (application) => application.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  /** Người viết; tài khoản bị xóa thì để null nhưng giữ ghi chú. */
  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author?: User | null;

  @Column({ type: 'text' })
  content: string;
}
