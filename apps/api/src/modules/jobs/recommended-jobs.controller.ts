import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LOCALES, Role, type Locale, type RecommendedJob } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import { RecommendedJobDto } from '../../common/swagger/public.dto';
import type { RequestUser } from '../../common/types/request-user';
import { PublicJobsService } from './public-jobs.service';

@ApiTags('Candidate – Recommended jobs')
@ApiBearerAuth()
@Roles(Role.CANDIDATE)
@Controller('me/recommended-jobs')
export class RecommendedJobsController {
  constructor(private readonly publicJobsService: PublicJobsService) {}

  @Get()
  @ApiOperation({
    summary: 'Gợi ý việc theo độ khớp kỹ năng',
    description:
      'Tối đa 20 tin công khai có ít nhất 1 kỹ năng trùng với hồ sơ, bỏ tin đã nộp (kể cả đã rút). Điểm cao trước, bằng điểm thì tin mới đăng trước. Hồ sơ chưa có kỹ năng thì trả mảng rỗng.',
  })
  @ApiQuery({ name: 'lang', enum: LOCALES, required: false })
  @ApiDataResponse(RecommendedJobDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(@CurrentUser() user: RequestUser, @Lang() lang: Locale): Promise<RecommendedJob[]> {
    return this.publicJobsService.recommended(user.id, lang);
  }
}
