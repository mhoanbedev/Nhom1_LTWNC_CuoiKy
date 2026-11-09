import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  LOCALES,
  Role,
  type Locale,
  type Paginated,
  type RecruiterApplication,
  type RecruiterApplicationListItem,
} from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import {
  ChangeApplicationStatusDto,
  RecruiterApplicationDto,
  RecruiterApplicationListItemDto,
  RecruiterApplicationsQueryDto,
} from './dto/application.dto';
import { RecruiterApplicationsService } from './recruiter-applications.service';

const OWNED_ERRORS = [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND];

@ApiTags('Recruiter – Applications')
@ApiBearerAuth()
@Roles(Role.RECRUITER)
@Controller('recruiter')
export class RecruiterApplicationsController {
  constructor(private readonly service: RecruiterApplicationsService) {}

  @Get('jobs/:id/applications')
  @ApiOperation({
    summary: 'Đơn nộp vào một tin của công ty mình, mới nộp lên trước',
    description: 'Lọc theo `status`. Tin của công ty khác trả 404.',
  })
  @ApiPaginatedResponse(RecruiterApplicationListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, ...OWNED_ERRORS)
  listForJob(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Query() query: RecruiterApplicationsQueryDto,
  ): Promise<Paginated<RecruiterApplicationListItem>> {
    return this.service.listForJob(user.companyId, jobId, query);
  }

  @Get('applications/:id')
  @ApiQuery({ name: 'lang', enum: LOCALES, required: false })
  @ApiOperation({
    summary: 'Chi tiết đơn: ảnh chụp hồ sơ, CV, lịch sử, trạng thái được chuyển tới',
    description: 'Đơn vào tin của công ty khác trả 404. Tải CV qua GET /files/cvs/:cvId.',
  })
  @ApiDataResponse(RecruiterApplicationDto)
  @ApiErrorResponses(...OWNED_ERRORS)
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() lang: Locale,
  ): Promise<RecruiterApplication> {
    return this.service.get(user.companyId, id, lang);
  }

  @Patch('applications/:id/status')
  @ApiQuery({ name: 'lang', enum: LOCALES, required: false })
  @ApiOperation({
    summary: 'Đổi trạng thái đơn (theo bảng mục 5.4)',
    description:
      'SUBMITTED → REVIEWING → INTERVIEW → PASSED, FAILED ở mọi bước còn mở. Chuyển sai: 400 APPLICATION_INVALID_TRANSITION; người khác vừa đổi trước: 409 APPLICATION_STATUS_CONFLICT. `note` ghi vào lịch sử, ứng viên cũng thấy.',
  })
  @ApiDataResponse(RecruiterApplicationDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, ...OWNED_ERRORS, HttpStatus.CONFLICT)
  changeStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeApplicationStatusDto,
    @Lang() lang: Locale,
  ): Promise<RecruiterApplication> {
    return this.service.changeStatus(user.id, user.companyId, id, body, lang);
  }
}
