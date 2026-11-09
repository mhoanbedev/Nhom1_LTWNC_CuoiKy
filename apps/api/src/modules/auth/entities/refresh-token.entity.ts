import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Refresh token xoay vòng (mục 6 của đặc tả). Chỉ lưu hash SHA-256, không lưu token gốc.
 * Các token cùng một phiên đăng nhập chung `familyId`; phát hiện dùng lại thì thu hồi cả family.
 */
@Entity('refresh_tokens')
export class RefreshToken extends AppBaseEntity {
  @Index('idx_refresh_tokens_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** SHA-256 dạng hex của token gốc (64 ký tự). */
  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Index('idx_refresh_tokens_family_id')
  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Token mới thay thế khi xoay vòng; dùng cho khoảng ân hạn 30 giây. */
  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;
}
