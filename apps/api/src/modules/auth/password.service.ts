import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Băm và kiểm mật khẩu bằng argon2id (mục 6 của đặc tả). */
@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash giả để kiểm khi email không tồn tại, cho thời gian phản hồi giống email có thật. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash('dummy-password-for-timing');
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash hỏng trong DB: coi như sai mật khẩu thay vì trả 500.
      return false;
    }
  }

  /**
   * Chạy một lần kiểm giả rồi bỏ kết quả. Gọi khi email không tồn tại để kẻ dò email
   * không phân biệt được "email sai" và "mật khẩu sai" qua thời gian phản hồi.
   */
  async verifyDummy(plain: string): Promise<void> {
    await this.verify(this.dummyHash, plain);
  }
}
