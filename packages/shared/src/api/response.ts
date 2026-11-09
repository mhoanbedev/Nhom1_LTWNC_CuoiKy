import type { ErrorCode } from '../errors/error-codes';

/** Response thành công của một bản ghi: `{ data }`. */
export interface ApiSuccess<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Response danh sách có phân trang: `{ data: T[], meta }`. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Format lỗi thống nhất của mọi endpoint. */
export interface ApiError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details: ApiErrorDetail[] | null;
  path: string;
  timestamp: string;
  requestId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function isPaginated(value: unknown): value is Paginated<unknown> {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) return false;
  const { page, limit, total, totalPages } = value.meta;
  return [page, limit, total, totalPages].every((n) => typeof n === 'number');
}
