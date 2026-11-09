/**
 * Bỏ dấu tiếng Việt: "Thực tập Đà Nẵng" → "Thuc tap Da Nang".
 * NFD tách chữ và dấu thành ký tự riêng rồi bỏ dấu; "đ/Đ" không tách được nên đổi tay.
 */
export function removeVietnameseTones(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Độ dài tối đa của phần chữ trong slug (chưa tính hậu tố như shortId). */
export const SLUG_MAX_LENGTH = 80;

/**
 * Slug cho URL: "Thực tập Backend Node.js" → "thuc-tap-backend-node-js".
 * Chỉ còn a-z, 0-9 và dấu "-"; cắt ở ranh giới từ nếu dài quá `maxLength`.
 * Chuỗi không có chữ hay số nào thì trả "" (nơi gọi tự quyết định dùng giá trị thay thế).
 */
export function slugify(input: string, maxLength = SLUG_MAX_LENGTH): string {
  const slug = removeVietnameseTones(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, maxLength)).replace(/-+$/, '');
}

/**
 * Chuẩn hoá chữ để tìm kiếm (cột `searchText`): bỏ dấu, viết thường, gộp khoảng trắng.
 * Gõ "thuc tap" hay "Thực Tập" đều khớp.
 */
export function normalizeSearchText(input: string): string {
  return removeVietnameseTones(input).toLowerCase().replace(/\s+/g, ' ').trim();
}
