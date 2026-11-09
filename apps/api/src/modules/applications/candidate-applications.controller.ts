import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  LOCALES,
  Role,
  type CandidateApplication,
  type CandidateApplicationListItem,
  type Locale,
  type Paginated,
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
import { ApplicationsService } from './applications.service';
import {
  ApplyDto,
  CandidateApplicationDto,
  CandidateApplicationListItemDto,
  MyApplicationsQueryDto,
} from './dto/application.dto';

@ApiTags('Candidate – Applications')
@ApiBearerAuth()
@ApiQuery({ name: 'lang', enum: LOCALES, required: false, description: 'Ngôn ngữ tên tin' })
@Roles(Role.CANDIDATE)
@Controller()
export class CandidateApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('jobs/:jobId/applications')
  @ApiOperation({
    summary: 'Nộp đơn vào tin',
    description:
      'Kiểm lần lượt: tin công khai (404; đã đóng/hết hạn 400 JOB_NOT_ACCEPTING), hồ sơ xong BASIC, EDUCATION, SKILLS (400 PROFILE_INCOMPLETE, details là bước còn thiếu), CV của mình và chưa xóa (400 CV_INVALID), chưa nộp tin này (409 APPLICATION_DUPLICATE, kể cả đơn đã rút).',
  })
  @ApiDataResponse(CandidateApplicationDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
  )
  apply(
    @CurrentUser() user: RequestUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: ApplyDto,
    @Lang() lang: Locale,
  ): Promise<CandidateApplication> {
    return this.applicationsService.apply(user.id, jobId, body, lang);
  }

  @Get('me/applications')
  @ApiOperation({ summary: 'Đơn của tôi, mới nộp lên trước; lọc theo `status`' })
  @ApiPaginatedResponse(CandidateApplicationListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: MyApplicationsQueryDto,
    @Lang() lang: Locale,
  ): Promise<Paginated<CandidateApplicationListItem>> {
    return this.applicationsService.listMine(user.id, query, lang);
  }

  @Post('me/applications/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rút đơn',
    description:
      'Chỉ khi đơn còn mở (SUBMITTED, REVIEWING, INTERVIEW), không thì 400 APPLICATION_INVALID_TRANSITION. Rút rồi không nộp lại tin đó được.',
  })
  @ApiDataResponse(CandidateApplicationDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
  )
  withdraw(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() lang: Locale,
  ): Promise<CandidateApplication> {
    return this.applicationsService.withdraw(user.id, id, lang);
  }

  @Get('me/applications/:id')
  @ApiOperation({
    summary: 'Chi tiết đơn của tôi kèm lịch sử trạng thái',
    description: 'Không có ghi chú nội bộ của nhà tuyển dụng. Đơn của người khác trả 404.',
  })
  @ApiDataResponse(CandidateApplicationDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
  getMine(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() lang: Locale,
  ): Promise<CandidateApplication> {
    return this.applicationsService.getMine(user.id, id, lang);
  }
}
