import { adminStatsQuerySchema, ApplicationStatus, JobStatus } from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class AdminStatsQueryDto extends createZodDto(adminStatsQuerySchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là AdminStats, RecruiterStats trong @ltwnc/shared. */
const counts = <T extends string>(keys: readonly T[]) =>
  z.object(
    Object.fromEntries(keys.map((key) => [key, z.number().int()])) as Record<T, z.ZodNumber>,
  );

const applicationCounts = counts(Object.values(ApplicationStatus));

export class AdminStatsDto extends createZodDto(
  z.object({
    days: z.number().int(),
    jobsByStatus: counts([...Object.values(JobStatus), 'hidden']),
    applicationsByStatus: applicationCounts,
    applicationsPerDay: z
      .array(
        z.object({ date: z.string().meta({ example: '2026-11-10' }), count: z.number().int() }),
      )
      .meta({ description: 'Đủ `days` ngày tới hôm nay (giờ Việt Nam), cũ trước' }),
    topCompanies: z
      .array(z.object({ id: z.uuid(), name: z.string(), applicationCount: z.number().int() }))
      .meta({ description: 'Tối đa 5 công ty nhận nhiều đơn nhất trong `days` ngày' }),
    pendingCompanies: z.number().int(),
  }),
) {}

export class RecruiterStatsDto extends createZodDto(
  z.object({
    totals: z.object({ total: z.number().int(), byStatus: applicationCounts }),
    jobs: z.array(
      z.object({
        jobId: z.uuid(),
        title: z.string().meta({ description: 'Tiêu đề bản vi' }),
        status: z.enum(Object.values(JobStatus)),
        isHidden: z.boolean(),
        total: z.number().int(),
        byStatus: applicationCounts,
      }),
    ),
  }),
) {}
