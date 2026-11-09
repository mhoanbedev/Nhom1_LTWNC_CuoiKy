/** Một CV của ứng viên (`/me/cvs`). Không có URL: CV riêng tư, tải qua `GET /files/cvs/:id`. */
export interface CvFile {
  id: string;
  /** Tên file lúc upload, để hiển thị và đặt tên khi tải về. */
  originalName: string;
  /** Byte. */
  size: number;
  /** CV mặc định được chọn sẵn khi nộp đơn. */
  isDefault: boolean;
  createdAt: string;
}

/** `GET /files/cvs/:id`: link tải ký sẵn, hết hạn sau 60 giây. */
export interface CvDownload {
  url: string;
  expiresAt: string;
}
