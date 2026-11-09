import { normalizeSearchText } from '@ltwnc/shared';

/** Ký tự đặc biệt của LIKE (%, _, \) trong từ khóa người dùng gõ được tìm đúng nghĩa đen. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Mẫu `LIKE` tìm chuỗi con trên cột `search_text` (đã bỏ dấu, viết thường). */
export function containsPattern(query: string): string {
  return `%${escapeLike(normalizeSearchText(query))}%`;
}
