import type { Locale, UserRole } from '@ltwnc/shared';

/** User đã xác thực, do JwtStrategy đọc từ DB và gắn vào `req.user`. */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  preferredLocale: Locale;
}
