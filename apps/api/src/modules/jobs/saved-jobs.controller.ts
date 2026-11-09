import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LOCALES, Role, type Locale, type Paginated, type SavedJobItem } from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import { CompanyJobsQueryDto, SavedJobItemDto } from '../../common/swagger/public.dto';
import type { RequestUser } from '../../common/types/request-user';
import { SavedJobsService } from './saved-jobs.service';

@ApiTags('Candidate – Saved jobs')
@ApiBearerAuth()
@Roles(Role.CANDIDATE)
@Controller('me/saved-jobs')
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Get()
  @ApiQuery({ name: 'lang', enum: LOCALES, required: false })
  @ApiOperation({
    summary: 'Tin đã lưu, lưu gần đây lên trước',
    description:
      'Tin đã đóng hay hết hạn vẫn hiện với `isAcceptingApplications: false`; tin bị ẩn hay công ty bị thu hồi duyệt thì không hiện.',
  })
  @ApiPaginatedResponse(SavedJobItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: CompanyJobsQueryDto,
    @Lang() lang: Locale,
  ): Promise<Paginated<SavedJobItem>> {
    return this.savedJobsService.list(user.id, query, lang);
  }

  @Put(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Lưu tin (idempotent)',
    description: 'Chỉ lưu được tin đang công khai, không thì 404. Lưu rồi gọi lại vẫn 204.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  save(
    @CurrentUser() user: RequestUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<void> {
    return this.savedJobsService.save(user.id, jobId);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bỏ lưu tin (idempotent: chưa lưu vẫn 204)' })
  @ApiNoContentResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  unsave(
    @CurrentUser() user: RequestUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<void> {
    return this.savedJobsService.unsave(user.id, jobId);
  }
}
