import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { OAuthProvider } from '@ltwnc/shared';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../database/pg-errors';
import { Account } from './entities/account.entity';

/** Liên kết user với tài khoản ở nhà cung cấp ngoài (bảng `accounts`). */
@Injectable()
export class AccountsService {
  constructor(@InjectRepository(Account) private readonly accounts: Repository<Account>) {}

  async findUserId(provider: OAuthProvider, providerAccountId: string): Promise<string | null> {
    const account = await this.accounts.findOneBy({ provider, providerAccountId });
    return account?.userId ?? null;
  }

  /**
   * Liên kết tài khoản ngoài vào user. Hai request đăng nhập cùng lúc cùng liên kết một tài
   * khoản thì request sau gặp ràng buộc unique: coi như đã liên kết, không báo lỗi.
   */
  async link(userId: string, provider: OAuthProvider, providerAccountId: string): Promise<void> {
    try {
      await this.accounts.insert({ userId, provider, providerAccountId });
    } catch (error) {
      if (isUniqueViolation(error, 'uq_accounts_provider_account')) return;
      throw error;
    }
  }
}
