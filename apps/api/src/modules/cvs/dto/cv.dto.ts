import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Chỉ để mô tả trên Swagger; kiểu thật là CvFile, CvDownload trong @ltwnc/shared. */
export class CvFileDto extends createZodDto(
  z.object({
    id: z.uuid(),
    originalName: z.string().meta({ example: 'CV Nguyễn An.pdf' }),
    size: z.number().int().meta({ description: 'Byte' }),
    isDefault: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
) {}

export class CvDownloadDto extends createZodDto(
  z.object({
    url: z.url().meta({ description: 'Link tải ký sẵn của Cloudinary' }),
    expiresAt: z.iso.datetime().meta({ description: 'Hết hạn sau 60 giây' }),
  }),
) {}
