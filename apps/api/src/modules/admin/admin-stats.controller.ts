import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type AdminStats, type Locale } from '@ltwnc/shared';
import { Lang } from '../../common/decorators/lang.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import { AdminStatsDto, AdminStatsQueryDto } from '../stats/dto/stats.dto';
import { StatsService } from '../stats/stats.service';

@ApiTags('Admin – Stats')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({
    summary: 'Dashboard admin',
    description:
      'Số tin, số đơn theo trạng thái (toàn bộ), số đơn theo ngày và top 5 công ty trong `days` ngày (mặc định 30, ngày theo giờ Việt Nam), số công ty chờ duyệt. Tên công ty theo `?lang`.',
  })
  @ApiDataResponse(AdminStatsDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(@Query() query: AdminStatsQueryDto, @Lang() lang: Locale): Promise<AdminStats> {
    return this.statsService.admin(query.days, lang);
  }
}
