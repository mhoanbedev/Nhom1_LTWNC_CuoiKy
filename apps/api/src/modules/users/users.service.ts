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
  passwordHash: string;
  preferredLocale: Locale;
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

  existsByEmail(email: string): Promise<boolean> {
    return this.users.existsBy({ email });
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
