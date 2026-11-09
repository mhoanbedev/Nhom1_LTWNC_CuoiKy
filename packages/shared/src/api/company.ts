import type { CompanyStatus } from '../enums/enums';
import type { CompanySize } from '../schemas/company.schema';

export interface CompanyTranslation {
  name: string;
  /** Sinh một lần lúc tạo bản dịch, không đổi khi sửa tên (giữ URL đã index). */
  slug: string;
  description: string | null;
}

/** Công ty của nhà tuyển dụng đang đăng nhập (`GET/PUT /recruiter/company`): đủ cả hai bản dịch. */
export interface RecruiterCompany {
  id: string;
  status: CompanyStatus;
  /** Lý do admin từ chối; chỉ có khi status là REJECTED. */
  rejectReason: string | null;
  logoUrl: string | null;
  website: string | null;
  size: CompanySize | null;
  industryId: string | null;
  locationId: string | null;
  address: string | null;
  approvedAt: string | null;
  translations: {
    vi: CompanyTranslation;
    en: CompanyTranslation | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CompanyLogo {
  logoUrl: string;
}
