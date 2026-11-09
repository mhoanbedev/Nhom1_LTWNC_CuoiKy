/**
 * Hợp đồng webhook revalidate (mục 9 của đặc tả): backend gọi `POST REVALIDATE_URL` kèm header
 * `x-revalidate-secret` và body `{ tags }` mỗi khi dữ liệu công khai đổi. Frontend gắn đúng các tag
 * này khi fetch (`next: { tags }`) rồi `revalidateTag` từng tag nhận được.
 */
export const REVALIDATE_SECRET_HEADER = 'x-revalidate-secret';

export interface RevalidatePayload {
  tags: string[];
}

export const RevalidateTag = {
  /** Danh sách tin: trang chủ, kết quả tìm kiếm có cache. */
  JOBS_LIST: 'jobs:list',
  /** Danh sách công ty. */
  COMPANIES_LIST: 'companies:list',
  SITEMAP: 'sitemap',
  /** Trang chi tiết một tin. */
  job: (jobId: string) => `job:${jobId}`,
  /**
   * Trang công ty. Trang chi tiết tin hiện tên và logo công ty, nên frontend gắn cả tag này
   * cho trang tin để đổi tên, logo công ty thì trang tin cũng được làm mới.
   */
  company: (companyId: string) => `company:${companyId}`,
} as const;
