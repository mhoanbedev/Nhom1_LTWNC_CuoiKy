import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../common/entities/app-base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * CV của ứng viên (mục 5.5 của đặc tả). File nằm trên Cloudinary ở chế độ `authenticated`, DB chỉ
 * giữ `cloudinaryPublicId`. Xóa là xóa mềm (`deletedAt`), vì đơn đã nộp vẫn trỏ tới CV.
 * `deletedAt` là cột thường (không dùng @DeleteDateColumn) để chỗ cần CV đã xóa (nhà tuyển dụng
 * tải CV của đơn) không phải nhớ `withDeleted`.
 */
@Entity('cv_files')
@Index('idx_cv_files_candidate_id', ['candidateId'])
/** Mỗi ứng viên tối đa một CV mặc định trong số CV chưa xóa: DB chặn luôn, không chỉ code. */
@Index('uq_cv_files_one_default', ['candidateId'], {
  unique: true,
  where: '"is_default" AND "deleted_at" IS NULL',
})
export class CvFile extends AppBaseEntity {
  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate?: User;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 255 })
  cloudinaryPublicId: string;

  /** Byte. */
  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
