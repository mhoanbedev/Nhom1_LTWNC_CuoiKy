import { RevalidateTag } from '@ltwnc/shared';

/**
 * Tag cần làm mới khi thông tin công khai của công ty đổi (sửa, đổi logo, duyệt, từ chối).
 * `jobs:list` vì thẻ tin trong danh sách hiện tên và logo công ty; trang chi tiết tin gắn thêm tag
 * `company:{id}` nên cũng được làm mới.
 */
export function companyTags(companyId: string): string[] {
  return [
    RevalidateTag.company(companyId),
    RevalidateTag.COMPANIES_LIST,
    RevalidateTag.JOBS_LIST,
    RevalidateTag.SITEMAP,
  ];
}
