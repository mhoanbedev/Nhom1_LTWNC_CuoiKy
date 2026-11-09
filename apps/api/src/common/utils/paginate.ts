import type { Paginated, PaginationQuery } from '@ltwnc/shared';

/** `skip`/`take` cho TypeORM từ `?page=&limit=`. */
export function toSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

/**
 * Gói kết quả `findAndCount`/`getManyAndCount` thành `{ data, meta }`.
 * TransformInterceptor nhận ra dạng này và không bọc thêm `{ data }`.
 */
export function paginate<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    data: items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
