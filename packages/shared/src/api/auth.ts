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
 * Response của /auth/register/*, /auth/login, /auth/oauth/google, /auth/refresh.
 * Mốc hết hạn dạng ISO 8601 để Auth.js biết khi nào cần refresh.
 */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}
