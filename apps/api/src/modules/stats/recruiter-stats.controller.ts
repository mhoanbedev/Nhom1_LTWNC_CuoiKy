import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type RecruiterStats } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import { RecruiterStatsDto } from './dto/stats.dto';
import { StatsService } from './stats.service';

@ApiTags('Recruiter – Stats')
@ApiBearerAuth()
@Roles(Role.RECRUITER)
@Controller('recruiter/stats')
export class RecruiterStatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({
    summary: 'Số đơn theo trạng thái của từng tin thuộc công ty mình',
    description: 'Mọi tin của công ty (kể cả nháp, bị ẩn), mới tạo trước, kèm tổng cộng.',
  })
  @ApiDataResponse(RecruiterStatsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(@CurrentUser() user: RequestUser): Promise<RecruiterStats> {
    return this.statsService.recruiter(user.companyId);
  }
}
