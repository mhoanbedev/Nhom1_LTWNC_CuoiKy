import { OAuthProvider } from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';

/** Liên kết một user với tài khoản ở nhà cung cấp ngoài (Google). */
@Entity('accounts')
@Index('uq_accounts_provider_account', ['provider', 'providerAccountId'], { unique: true })
export class Account extends AppBaseEntity {
  @Index('idx_accounts_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'enum', enum: Object.values(OAuthProvider), enumName: 'oauth_provider' })
  provider: OAuthProvider;

  /** `sub` của Google: định danh ổn định, không đổi khi user đổi email. */
  @Column({ type: 'varchar', length: 255 })
  providerAccountId: string;
}
