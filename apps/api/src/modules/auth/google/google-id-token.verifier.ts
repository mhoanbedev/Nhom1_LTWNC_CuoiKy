import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ErrorCode } from '@ltwnc/shared';
import { OAuth2Client } from 'google-auth-library';
import { AppException } from '../../../common/exceptions/app.exception';
import { googleConfig } from '../../../config/google.config';

/** Thông tin lấy từ `id_token` đã verify. Chỉ tin các trường này, không tin dữ liệu client tự gửi. */
export interface GoogleIdentity {
  /** Định danh ổn định của tài khoản Google, không đổi khi user đổi email. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Lớp tích hợp duy nhất với Google; test thay lớp này bằng bản giả. */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(@Inject(googleConfig.KEY) private readonly config: ConfigType<typeof googleConfig>) {}

  /**
   * Kiểm chữ ký, hạn, issuer và audience (= GOOGLE_CLIENT_ID).
   * Không tải được khóa công khai của Google thì 503; token sai thì 401.
   */
  async verify(idToken: string): Promise<GoogleIdentity> {
    // Tải khóa trước (thư viện tự cache) để tách lỗi mạng khỏi lỗi token.
    try {
      await this.client.getFederatedSignonCertsAsync();
    } catch {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.config.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AppException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
    }
    if (!payload?.sub) throw new AppException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);

    return {
      sub: payload.sub,
      email: payload.email?.trim().toLowerCase() || null,
      emailVerified: payload.email_verified === true,
      name: payload.name?.trim() || null,
      picture: payload.picture || null,
    };
  }
}
