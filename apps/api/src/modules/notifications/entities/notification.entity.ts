import { NotificationType, type NotificationPayload } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Thông báo trong hệ thống (mục 5.8 của đặc tả). Chỉ lưu `type` + tham số (`data`), câu chữ dịch
 * lúc đọc theo ngôn ngữ của người nhận. Tạo trong cùng transaction với hành động sinh ra nó.
 */
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
export class Notification extends AppBaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: Object.values(NotificationType),
    enumName: 'notification_type',
  })
  type: NotificationPayload['type'];

  @Column({ type: 'jsonb' })
  data: NotificationPayload['data'];

  /** null: chưa đọc. */
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
