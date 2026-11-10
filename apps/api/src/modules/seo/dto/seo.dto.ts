import { LOCALES, SEO_PAGE_TYPES, seoStaticParamsQuerySchema } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class SeoStaticParamsQueryDto extends createZodDto(seoStaticParamsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là SitemapEntry, StaticParam trong @ltwnc/shared. */
const staticParam = z.object({
  locale: z.enum(LOCALES),
  slug: z.string().meta({ example: 'thuc-tap-backend-nodejs-a1b2c3' }),
});

export class StaticParamDto extends createZodDto(staticParam) {}

export class SitemapEntryDto extends createZodDto(
  z.object({
    type: z.enum(SEO_PAGE_TYPES),
    id: z.uuid(),
    updatedAt: z.iso
      .datetime()
      .meta({ description: 'Mốc sửa mới nhất (gồm bản dịch), làm lastmod' }),
    alternates: z
      .array(staticParam)
      .meta({ description: 'Chỉ ngôn ngữ đã có bản dịch, vi đứng đầu' }),
  }),
) {}
