import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode, Role, type Locale } from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { isUniqueViolation } from '../../database/pg-errors';
import { User } from './entities/user.entity';

export interface CreateCandidateData {
  email: string;
  name: string;
  /** Null khi tạo từ đăng nhập Google: chỉ đăng nhập được bằng Google cho tới khi đặt mật khẩu. */
  passwordHash: string | null;
  preferredLocale: Locale;
  avatarUrl?: string | null;
}

export interface UpdateProfileData {
  name?: string;
  preferredLocale?: Locale;
}

/** Module users là nơi duy nhất ghi bảng `users`; module khác gọi qua service này. */
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  /** Kèm `passwordHash` (mặc định cột này không được select). */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  /** Kèm `passwordHash`, dùng khi đổi mật khẩu. */
  findByIdWithPassword(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  /** `email` phải đã chuẩn hoá chữ thường. */
  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.users.existsBy({ email });
  }

  /** Cập nhật tên, ngôn ngữ ưa thích. User không tồn tại thì 404. */
  async updateProfile(id: string, data: UpdateProfileData): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new AppException(ErrorCode.NOT_FOUND);
    if (data.name !== undefined) user.name = data.name;
    if (data.preferredLocale !== undefined) user.preferredLocale = data.preferredLocale;
    return this.users.save(user);
  }

  /**
   * Đặt mật khẩu mới và ghi mốc `passwordChangedAt`: JwtStrategy từ chối mọi access token
   * cấp trước mốc này, nên các thiết bị khác bị đăng xuất ngay chứ không đợi token hết hạn.
   */
  async setPassword(id: string, passwordHash: string): Promise<User> {
    await this.users.update(id, { passwordHash, passwordChangedAt: new Date() });
    const user = await this.users.findOneBy({ id });
    if (!user) throw new AppException(ErrorCode.NOT_FOUND);
    return user;
  }

  /**
   * Tạo ứng viên. Email trùng trả 409 AUTH_EMAIL_TAKEN, kể cả khi hai request đăng ký
   * cùng lúc vượt qua bước kiểm tra trước (ràng buộc unique trong DB chặn lần ghi thứ hai).
   */
  async createCandidate(data: CreateCandidateData): Promise<User> {
    try {
      return await this.users.save(this.users.create({ ...data, role: Role.CANDIDATE }));
    } catch (error) {
      if (isUniqueViolation(error, 'uq_users_email')) {
        throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
      }
      throw error;
    }
  }
}
