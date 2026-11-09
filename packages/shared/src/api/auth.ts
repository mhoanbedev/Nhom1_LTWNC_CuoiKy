import type { UserRole } from '../enums/enums';
import type { Locale } from '../enums/locale';

/** Thông tin user trả kèm khi đăng nhập; Auth.js lưu vào session. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  preferredLocale: Locale;
  avatarUrl: string | null;
}

/**
 * Cặp token. Mốc hết hạn dạng ISO 8601 để Auth.js biết khi nào cần gọi /auth/refresh
 * (đặc tả mục 6: refresh khi access token còn dưới 60 giây).
 */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Response của /auth/register/*, /auth/login, /auth/oauth/google, /auth/refresh. */
export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}
