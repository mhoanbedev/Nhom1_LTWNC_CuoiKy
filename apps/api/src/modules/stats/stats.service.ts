import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ApplicationStatus,
  CompanyStatus,
  JobStatus,
  type AdminStats,
  type ApplicationCounts,
  type DailyCount,
  type Locale,
  type RecruiterJobStats,
  type RecruiterStats,
} from '@ltwnc/shared';
import { DataSource } from 'typeorm';
import { Application } from '../applications/entities/application.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { dailyRange, fillDailySeries, STATS_TIME_ZONE } from './daily-series';

const APPLICATION_STATUSES = Object.values(ApplicationStatus);
const JOB_STATUSES = Object.values(JobStatus);
const TOP_COMPANIES = 5;

/**
 * `COUNT(*) FILTER` cho từng giá trị trạng thái, mỗi giá trị một cột cùng tên. Giá trị là hằng enum
 * trong code (không phải dữ liệu người dùng) nên ghép thẳng vào SQL được.
 */
function countByStatus(column: string, statuses: readonly string[], counted = '*'): string[] {
  return statuses.map(
    (status) => `COUNT(${counted}) FILTER (WHERE ${column} = '${status}')::int AS "${status}"`,
  );
}

/** Lấy các cột trạng thái từ một dòng raw; thiếu (không có dòng) thì 0. */
function pickCounts<K extends string>(
  row: Partial<Record<K, number>> | undefined,
  keys: readonly K[],
): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, row?.[key] ?? 0])) as Record<K, number>;
}

/** Một dòng GROUP BY theo tin: số đơn mỗi trạng thái nằm ở cột cùng tên. */
export type RawJobStats = Record<ApplicationStatus, number> & {
  jobId: string;
  title: string;
  status: JobStatus;
  isHidden: boolean;
  total: number;
};

/** Dòng GROUP BY theo tin → thống kê của nhà tuyển dụng, kèm tổng cộng mọi tin. */
export function toRecruiterStats(rows: RawJobStats[]): RecruiterStats {
  const jobs: RecruiterJobStats[] = rows.map((row) => ({
    jobId: row.jobId,
    title: row.title,
    status: row.status,
    isHidden: row.isHidden,
    total: row.total,
    byStatus: pickCounts(row, APPLICATION_STATUSES),
  }));
  const byStatus: ApplicationCounts = pickCounts(undefined, APPLICATION_STATUSES);
  for (const job of jobs) {
    for (const status of APPLICATION_STATUSES) byStatus[status] += job.byStatus[status];
  }
  const total = jobs.reduce((sum, job) => sum + job.total, 0);
  return { totals: { total, byStatus }, jobs };
}

/**
 * Thống kê (mục 5.9 của đặc tả). Chỉ đọc: gom số liệu từ bảng tin, đơn, công ty bằng GROUP BY,
 * không ghi bảng nào.
 */
@Injectable()
export class StatsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Dashboard admin. Số theo trạng thái tính trên toàn bộ dữ liệu; theo ngày và top công ty trong
   * `days` ngày.
   */
  async admin(days: number, lang: Locale, now = new Date()): Promise<AdminStats> {
    const { since } = dailyRange(days, now);
    const [jobs, applications, perDay, topCompanies, pendingCompanies] = await Promise.all([
      this.jobCounts(),
      this.applicationCounts(),
      this.applicationsPerDay(since),
      this.topCompanies(since, lang),
      this.dataSource.getRepository(Company).countBy({ status: CompanyStatus.PENDING }),
    ]);
    return {
      days,
      jobsByStatus: { ...pickCounts(jobs, JOB_STATUSES), hidden: jobs?.hidden ?? 0 },
      applicationsByStatus: pickCounts(applications, APPLICATION_STATUSES),
      applicationsPerDay: fillDailySeries(perDay, days, now),
      topCompanies,
      pendingCompanies,
    };
  }

  /** Số đơn theo trạng thái của từng tin thuộc công ty, mới tạo trước, kèm tổng cộng. */
  async recruiter(companyId: string | null): Promise<RecruiterStats> {
    // Nhà tuyển dụng luôn có công ty; null chỉ là phòng hờ, trả số liệu rỗng.
    return toRecruiterStats(companyId ? await this.jobApplicationCounts(companyId) : []);
  }

  private jobCounts(): Promise<Record<string, number> | undefined> {
    return this.dataSource
      .getRepository(Job)
      .createQueryBuilder('job')
      .select(countByStatus('job.status', JOB_STATUSES))
      .addSelect('COUNT(*) FILTER (WHERE job.isHidden)::int', 'hidden')
      .getRawOne<Record<string, number>>();
  }

  private applicationCounts(): Promise<Record<string, number> | undefined> {
    return this.dataSource
      .getRepository(Application)
      .createQueryBuilder('app')
      .select(countByStatus('app.status', APPLICATION_STATUSES))
      .getRawOne<Record<string, number>>();
  }

  /** Số đơn nộp mỗi ngày (giờ VN) từ `since`; chỉ có những ngày có đơn. */
  private applicationsPerDay(since: Date): Promise<DailyCount[]> {
    const day = `to_char((app.submittedAt AT TIME ZONE '${STATS_TIME_ZONE}')::date, 'YYYY-MM-DD')`;
    return this.dataSource
      .getRepository(Application)
      .createQueryBuilder('app')
      .select(day, 'date')
      .addSelect('COUNT(*)::int', 'count')
      .where('app.submittedAt >= :since', { since })
      .groupBy(day)
      .getRawMany<DailyCount>();
  }

  /** Công ty nhận nhiều đơn nhất từ `since`; tên theo `lang`, thiếu bản dịch đó thì dùng vi. */
  private topCompanies(since: Date, lang: Locale): Promise<AdminStats['topCompanies']> {
    return this.dataSource
      .getRepository(Application)
      .createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .innerJoin('job.company', 'company')
      .innerJoin('company.translations', 'vi', "vi.locale = 'vi'")
      .leftJoin('company.translations', 'tl', 'tl.locale = :lang', { lang })
      .select('company.id', 'id')
      .addSelect('COALESCE(tl.name, vi.name)', 'name')
      .addSelect('COUNT(*)::int', 'applicationCount')
      .where('app.submittedAt >= :since', { since })
      .groupBy('company.id')
      .addGroupBy('vi.name')
      .addGroupBy('tl.name')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('company.id', 'ASC')
      .limit(TOP_COMPANIES)
      .getRawMany<AdminStats['topCompanies'][number]>();
  }

  private jobApplicationCounts(companyId: string): Promise<RawJobStats[]> {
    return this.dataSource
      .getRepository(Job)
      .createQueryBuilder('job')
      .innerJoin('job.translations', 'vi', "vi.locale = 'vi'")
      .leftJoin(Application, 'app', 'app.jobId = job.id')
      .select('job.id', 'jobId')
      .addSelect('vi.title', 'title')
      .addSelect('job.status', 'status')
      .addSelect('job.isHidden', 'isHidden')
      .addSelect('COUNT(app.id)::int', 'total')
      .addSelect(countByStatus('app.status', APPLICATION_STATUSES, 'app.id'))
      .where('job.companyId = :companyId', { companyId })
      .groupBy('job.id')
      .addGroupBy('vi.title')
      .orderBy('job.createdAt', 'DESC')
      .addOrderBy('job.id', 'ASC')
      .getRawMany<RawJobStats>();
  }
}
