import { COMPANY_SIZES, companyInfoSchema, CompanyStatus } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CompanyInfoDto extends createZodDto(companyInfoSchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là RecruiterCompany trong @ltwnc/shared. */
const translation = z.object({
  name: z.string(),
  slug: z.string().meta({ description: 'Sinh một lần lúc tạo bản dịch, không đổi khi sửa tên' }),
  description: z.string().nullable(),
});

export class RecruiterCompanyDto extends createZodDto(
  z.object({
    id: z.uuid(),
    status: z.enum(Object.values(CompanyStatus)),
    rejectReason: z.string().nullable(),
    logoUrl: z.url().nullable(),
    website: z.url().nullable(),
    size: z.enum(COMPANY_SIZES).nullable(),
    industryId: z.uuid().nullable(),
    locationId: z.uuid().nullable(),
    address: z.string().nullable(),
    approvedAt: z.iso.datetime().nullable(),
    translations: z.object({ vi: translation, en: translation.nullable() }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
) {}

export class CompanyLogoDto extends createZodDto(z.object({ logoUrl: z.url() })) {}
