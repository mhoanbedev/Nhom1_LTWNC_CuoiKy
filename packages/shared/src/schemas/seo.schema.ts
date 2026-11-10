import { z } from 'zod';
import { SEO_PAGE_TYPES } from '../api/seo';

/** `GET /seo/static-params?type=job&limit=100`: trang nào build sẵn lúc build Next. */
export const seoStaticParamsQuerySchema = z.object({
  type: z.enum(SEO_PAGE_TYPES),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});
export type SeoStaticParamsQuery = z.infer<typeof seoStaticParamsQuerySchema>;
