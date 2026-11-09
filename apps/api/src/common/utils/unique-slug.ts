import { slugify } from '@ltwnc/shared';

/**
 * Slug không trùng: thử `base`, rồi `base-2`, `base-3`... `isTaken` kiểm trong DB theo đúng phạm vi
 * unique (vd cùng locale). Tên không có chữ/số nào (vd "!!!") thì dùng `fallback`.
 * Hai request cùng lúc vẫn có thể chọn trùng; khi đó ràng buộc unique trong DB chặn và trả 409.
 */
export async function uniqueSlug(
  text: string,
  fallback: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(text) || fallback;
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Không tìm được slug trống cho "${base}"`);
}
