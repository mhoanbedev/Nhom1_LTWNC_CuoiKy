import { z } from 'zod';
import { WorkMode } from '../enums/enums';
import { JOB_SKILLS_MAX } from './job.schema';
import { paginationQuerySchema, searchQuerySchema } from './pagination.schema';

export const JOB_SORTS = ['newest', 'deadline', 'relevance'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

/** `?isPaid=true|false` trong query string. */
const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** `?skills=a&skills=b`, `?skills=a,b` hoặc `?skills[]=a` đều thành mảng id. */
const idListQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item) => String(item).split(',')).filter(Boolean);
}, z.array(z.uuid()).max(JOB_SKILLS_MAX).optional());

/** Gộp `skills[]` (cách viết của nhiều thư viện frontend) vào `skills`. */
const withArrayKeys = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return value;
  const query = value as Record<string, unknown>;
  return 'skills[]' in query ? { ...query, skills: query['skills'] ?? query['skills[]'] } : query;
};

/**
 * `GET /jobs`: tin công khai. Không truyền `sort` thì có `q` xếp theo độ liên quan, không có
 * `q` xếp mới nhất. Lọc kỹ năng là "có ít nhất một kỹ năng trong danh sách".
 */
export const publicJobsQuerySchema = z.preprocess(
  withArrayKeys,
  paginationQuerySchema.extend({
    q: searchQuerySchema,
    skills: idListQuery,
    locationId: z.uuid().optional(),
    workMode: z.enum(Object.values(WorkMode)).optional(),
    isPaid: booleanQuery,
    sort: z.enum(JOB_SORTS).optional(),
  }),
);
export type PublicJobsQuery = z.infer<typeof publicJobsQuerySchema>;

/** `GET /companies`: công ty đã duyệt. */
export const publicCompaniesQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  industryId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});
export type PublicCompaniesQuery = z.infer<typeof publicCompaniesQuerySchema>;

/** `GET /companies/:slug/jobs`: chỉ phân trang. */
export const companyJobsQuerySchema = paginationQuerySchema;
export type CompanyJobsQuery = z.infer<typeof companyJobsQuerySchema>;
