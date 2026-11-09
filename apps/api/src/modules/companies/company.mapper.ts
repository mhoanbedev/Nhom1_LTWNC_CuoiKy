import type {
  AdminCompany,
  CompanyTranslation as CompanyTranslationDto,
  RecruiterCompany,
} from '@ltwnc/shared';
import { ErrorCode } from '@ltwnc/shared';
import { AppException } from '../../common/exceptions/app.exception';
import type { CompanyTranslation } from './entities/company-translation.entity';
import type { Company } from './entities/company.entity';

function toTranslation(row: CompanyTranslation): CompanyTranslationDto {
  return { name: row.name, slug: row.slug, description: row.description };
}

/** Entity (kèm `translations`) → công ty của nhà tuyển dụng, đủ cả hai bản dịch. */
export function toRecruiterCompany(company: Company): RecruiterCompany {
  const translations = company.translations ?? [];
  const vi = translations.find((t) => t.locale === 'vi');
  const en = translations.find((t) => t.locale === 'en');
  // Bản vi luôn được tạo cùng công ty; thiếu là dữ liệu hỏng.
  if (!vi) throw new AppException(ErrorCode.INTERNAL_ERROR);
  return {
    id: company.id,
    status: company.status,
    rejectReason: company.rejectReason,
    logoUrl: company.logoUrl,
    website: company.website,
    size: company.size,
    industryId: company.industryId,
    locationId: company.locationId,
    address: company.address,
    approvedAt: company.approvedAt?.toISOString() ?? null,
    translations: { vi: toTranslation(vi), en: en ? toTranslation(en) : null },
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

/** Entity (kèm `translations` và `owner`) → công ty trong màn quản trị. */
export function toAdminCompany(company: Company): AdminCompany {
  const owner = company.owner;
  if (!owner) throw new AppException(ErrorCode.INTERNAL_ERROR);
  return {
    ...toRecruiterCompany(company),
    owner: { id: owner.id, email: owner.email, name: owner.name },
  };
}
