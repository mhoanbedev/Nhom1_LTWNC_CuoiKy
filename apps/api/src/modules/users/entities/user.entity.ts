import {
  DEFAULT_LOCALE,
  LOCALES,
  Role,
  USER_ROLES,
  UserStatus,
  type Locale,
  type UserRole,
} from '@ltwnc/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';

@Entity('users')
/** Hệ thống chỉ có đúng 1 admin (tạo qua seed): DB chặn luôn dòng ADMIN thứ hai. */
@Index('uq_users_single_admin', ['role'], { unique: true, where: `"role" = 'ADMIN'` })
export class User extends AppBaseEntity {
  /** Luôn lưu chữ thường (chuẩn hoá ở service) để unique không phân biệt hoa thường. */
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Null khi tài khoản chỉ đăng nhập bằng Google. Không bao giờ trả ra response. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  /** Token cấp trước mốc này bị từ chối (đổi mật khẩu vô hiệu ngay access token cũ). */
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'user_role', default: Role.CANDIDATE })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: Object.values(UserStatus),
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'enum', enum: LOCALES, enumName: 'locale', default: DEFAULT_LOCALE })
  preferredLocale: Locale;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  /** public_id trên Cloudinary, để xóa ảnh cũ khi đổi avatar. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarPublicId: string | null;

  /** Chỉ recruiter có: công ty của nhà tuyển dụng (trùng `companies.owner_id`). */
  @Index('idx_users_company_id')
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'company_id' })
  company?: Company | null;
}
