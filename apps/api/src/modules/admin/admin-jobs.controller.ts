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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type AdminJob, type Paginated } from '@ltwnc/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import { AdminJobDto, AdminJobsQueryDto, HideJobDto } from '../jobs/dto/job.dto';
import { JobsAdminService } from '../jobs/jobs-admin.service';

@ApiTags('Admin – Jobs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly jobsAdminService: JobsAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách tin ở mọi trạng thái, mới tạo lên trước',
    description:
      'Lọc theo `status`, `hidden` (true chỉ lấy tin bị ẩn) và `q` (tiêu đề cả hai ngôn ngữ, gõ không dấu được).',
  })
  @ApiPaginatedResponse(AdminJobDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(@Query() query: AdminJobsQueryDto): Promise<Paginated<AdminJob>> {
    return this.jobsAdminService.list(query);
  }

  @Patch(':id/hide')
  @ApiOperation({
    summary: 'Ẩn tin vi phạm kèm lý do',
    description:
      'Tin biến khỏi web (404) ở mọi trạng thái, nhà tuyển dụng nhận thông báo JOB_HIDDEN. Tin đang ẩn thì giữ nguyên lý do cũ, không báo lại.',
  })
  @ApiDataResponse(AdminJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() body: HideJobDto): Promise<AdminJob> {
    return this.jobsAdminService.hide(id, body.reason);
  }

  @Patch(':id/unhide')
  @ApiOperation({ summary: 'Bỏ ẩn: tin về lại trạng thái cũ' })
  @ApiDataResponse(AdminJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  unhide(@Param('id', ParseUUIDPipe) id: string): Promise<AdminJob> {
    return this.jobsAdminService.unhide(id);
  }
}
