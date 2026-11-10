import { Module } from '@nestjs/common';
import { RecruiterStatsController } from './recruiter-stats.controller';
import { StatsService } from './stats.service';

/** Thống kê chỉ đọc (mục 5.9 của đặc tả). `/admin/stats` nằm ở module admin. */
@Module({
  controllers: [RecruiterStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
