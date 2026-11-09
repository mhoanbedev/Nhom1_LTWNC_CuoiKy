import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type Paginated, type RecruiterJob, type RecruiterJobListItem } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import {
  CreateJobDto,
  RecruiterJobDto,
  RecruiterJobListItemDto,
  RecruiterJobsQueryDto,
  ReopenJobDto,
  UpdateJobDto,
} from './dto/job.dto';
import { RecruiterJobsService } from './recruiter-jobs.service';

@ApiTags('Recruiter – Jobs')
@ApiBearerAuth()
@Roles(Role.RECRUITER)
@Controller('recruiter/jobs')
export class RecruiterJobsController {
  constructor(private readonly recruiterJobsService: RecruiterJobsService) {}

  @Get()
  @ApiOperation({
    summary: 'Tin của công ty mình, sửa gần đây lên trước',
    description: 'Lọc theo `status` và `q` (tiêu đề, nội dung, gõ không dấu được).',
  })
  @ApiPaginatedResponse(RecruiterJobListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: RecruiterJobsQueryDto,
  ): Promise<Paginated<RecruiterJobListItem>> {
    return this.recruiterJobsService.list(user.companyId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo tin nháp',
    description:
      'Bản vi bắt buộc. Công ty chưa được duyệt thì 403 COMPANY_NOT_APPROVED. Tin ở trạng thái DRAFT, chưa công khai cho tới khi đăng.',
  })
  @ApiDataResponse(RecruiterJobDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  create(@CurrentUser() user: RequestUser, @Body() body: CreateJobDto): Promise<RecruiterJob> {
    return this.recruiterJobsService.create(user.companyId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tin của công ty mình (đủ cả bản vi và en)' })
  @ApiDataResponse(RecruiterJobDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecruiterJob> {
    return this.recruiterJobsService.get(user.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Sửa tin',
    description:
      'Gửi trường nào sửa trường đó. `skills` gửi lên là thay cả danh sách; `translations` gửi lên thì bỏ `en` là xóa bản en. Tắt `isPaid` thì mức lương bị xóa.',
  })
  @ApiDataResponse(RecruiterJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateJobDto,
  ): Promise<RecruiterJob> {
    return this.recruiterJobsService.update(user.companyId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa tin nháp',
    description: 'Chỉ xóa được tin DRAFT; tin đã đăng thì đóng (400 JOB_INVALID_TRANSITION).',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.recruiterJobsService.remove(user.companyId, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng tin nháp (DRAFT → PUBLISHED)',
    description:
      'Cần công ty đã duyệt (không thì 403 COMPANY_NOT_APPROVED), có bản vi, hạn nhận hồ sơ ở tương lai, ít nhất 1 kỹ năng. Thiếu điều kiện thì 400 JOB_INVALID_TRANSITION, `details` liệt kê từng điều kiện còn thiếu.',
  })
  @ApiDataResponse(RecruiterJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  publish(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecruiterJob> {
    return this.recruiterJobsService.publish(user.companyId, id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đóng tin đang đăng (PUBLISHED → CLOSED): ngừng nhận đơn' })
  @ApiDataResponse(RecruiterJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  close(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecruiterJob> {
    return this.recruiterJobsService.close(user.companyId, id);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mở lại tin đã đóng (CLOSED → PUBLISHED)',
    description: 'Bắt buộc gửi `expiresAt` mới ở tương lai; kiểm lại điều kiện như khi đăng.',
  })
  @ApiDataResponse(RecruiterJobDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  reopen(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReopenJobDto,
  ): Promise<RecruiterJob> {
    return this.recruiterJobsService.reopen(user.companyId, id, body);
  }
}
