import type { LocalizedText, Locale } from '@ltwnc/shared';

/**
 * Lấy một trường (vd `title`, `name`) ở cả bản vi và en của danh sách bản dịch, để lưu vào thông báo:
 * đọc bằng tiếng Anh vẫn có tên tiếng Anh. Thiếu bản vi (dữ liệu hỏng) thì để chuỗi rỗng.
 */
export function localizedText<T extends { locale: Locale }>(
  rows: T[] | undefined,
  field: keyof T & string,
): LocalizedText {
  const value = (locale: Locale): string | null => {
    const row = rows?.find((item) => item.locale === locale);
    return row ? String(row[field]) : null;
  };
  return { vi: value('vi') ?? '', en: value('en') };
}
