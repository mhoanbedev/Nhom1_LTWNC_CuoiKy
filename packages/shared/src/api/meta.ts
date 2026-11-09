/**
 * Danh mục trả từ `GET /meta/*`. `name` đã chọn theo `?lang`; frontend dùng `id` khi gửi lên
 * (lọc tin, hồ sơ), còn `slug`/`code` ổn định giữa các môi trường, hợp để dựng URL lọc.
 */
export interface SkillItem {
  id: string;
  slug: string;
  name: string;
}

export interface IndustryItem {
  id: string;
  slug: string;
  name: string;
}

export interface LocationItem {
  id: string;
  code: string;
  name: string;
}
