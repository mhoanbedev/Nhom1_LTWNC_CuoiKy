import { QueryFailedError } from 'typeorm';

/** Mã lỗi Postgres: https://www.postgresql.org/docs/current/errcodes-appendix.html */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

/** Lấy mã lỗi Postgres (vd `23505`) từ lỗi TypeORM; không phải lỗi query thì trả undefined. */
export function pgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError: unknown = error.driverError;
  if (typeof driverError === 'object' && driverError !== null && 'code' in driverError) {
    return String(driverError.code);
  }
  return undefined;
}

/** Vi phạm ràng buộc unique, có thể chỉ rõ tên ràng buộc (vd `uq_users_email`). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (pgErrorCode(error) !== PG_UNIQUE_VIOLATION) return false;
  if (!constraint || !(error instanceof QueryFailedError)) return true;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'constraint' in driverError &&
    driverError.constraint === constraint
  );
}
