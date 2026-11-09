import type { ApplicationStatus, NotificationType } from '../enums/enums';

/** Chữ lưu cả hai ngôn ngữ lúc tạo thông báo (vd tên tin); `en` null khi chưa có bản tiếng Anh. */
export interface LocalizedText {
  vi: string;
  en: string | null;
}

/**
 * Tham số của từng loại thông báo (mục 5.8 của đặc tả): DB chỉ lưu `type` + `data`, câu chữ dịch lúc
 * đọc. Không lưu đường dẫn: frontend tự dựng link từ `type` và các id trong `data`.
 */
export type NotificationPayload =
  | {
      type: typeof NotificationType.NEW_APPLICATION;
      data: {
        applicationId: string;
        jobId: string;
        jobTitle: LocalizedText;
        candidateName: string;
      };
    }
  | {
      type: typeof NotificationType.APPLICATION_STATUS_CHANGED;
      data: {
        applicationId: string;
        jobId: string;
        jobTitle: LocalizedText;
        fromStatus: ApplicationStatus;
        toStatus: ApplicationStatus;
        /** Ghi chú nhà tuyển dụng gửi kèm (ứng viên thấy). */
        note: string | null;
        /** Có khi người nhận là nhà tuyển dụng (ứng viên rút đơn). */
        candidateName: string | null;
      };
    }
  | {
      type: typeof NotificationType.COMPANY_APPROVED;
      data: { companyId: string; companyName: LocalizedText };
    }
  | {
      type: typeof NotificationType.COMPANY_REJECTED;
      data: { companyId: string; companyName: LocalizedText; reason: string };
    }
  | {
      type: typeof NotificationType.JOB_HIDDEN;
      data: { jobId: string; jobTitle: LocalizedText; reason: string };
    };

/** Một thông báo trong `GET /me/notifications`: kèm `title`, `body` đã dịch. */
export type NotificationItem = NotificationPayload & {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export interface UnreadCount {
  count: number;
}

export interface ReadAllResult {
  /** Số thông báo vừa được đánh dấu đã đọc. */
  updated: number;
}
