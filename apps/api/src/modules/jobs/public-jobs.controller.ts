import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  LOCALES,
  type Locale,
  type Paginated,
  type PublicJobDetail,
  type PublicJobListItem,
} from '@ltwnc/shared';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import {
  CompanyJobsQueryDto,
  PublicJobDetailDto,
  PublicJobListItemDto,
  PublicJobsQueryDto,
} from '../../common/swagger/public.dto';
import { CompaniesPublicService } from '../companies/companies-public.service';
import { PublicJobsService } from './public-jobs.service';

@ApiTags('Public – Jobs')
@ApiQuery({ name: 'lang', enum: LOCALES, required: false })
@Public()
@Controller()
export class PublicJobsController {
  constructor(
    private readonly publicJobsService: PublicJobsService,
    private readonly companiesPublicService: CompaniesPublicService,
  ) {}

  @Get('jobs')
  @ApiOperation({
    summary: 'Tìm tin công khai',
    description:
      '`q` gõ không dấu được. `skills` nhận nhiều id (`?skills=a&skills=b`, `?skills=a,b` hoặc `?skills[]=a`), tin có ít nhất một kỹ năng là khớp. `sort`: newest (mặc định), deadline, relevance (mặc định khi có `q`). Tin chưa có bản theo `lang` vẫn hiện, kèm `locale: "vi"`.',
  })
  @ApiPaginatedResponse(PublicJobListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  list(
    @Query() query: PublicJobsQueryDto,
    @Lang() lang: Locale,
  ): Promise<Paginated<PublicJobListItem>> {
    return this.publicJobsService.list(query, lang);
  }

  @Get('jobs/:slug')
  @ApiOperation({
    summary: 'Chi tiết tin công khai',
    description:
      'Tìm theo shortId ở cuối slug. Tin đã đóng hoặc hết hạn: 200 với `seo.indexable: false`, `isAcceptingApplications: false`. Nháp, bị ẩn, công ty chưa duyệt, hoặc không có bản theo `lang`: 404. Slug trên URL khác `canonicalSlug` thì frontend redirect 308.',
  })
  @ApiDataResponse(PublicJobDetailDto)
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  detail(@Param('slug') slug: string, @Lang() lang: Locale): Promise<PublicJobDetail> {
    return this.publicJobsService.detail(slug, lang);
  }

  @Get('companies/:slug/jobs')
  @ApiTags('Public – Companies')
  @ApiOperation({ summary: 'Tin công khai của một công ty, mới đăng lên trước' })
  @ApiPaginatedResponse(PublicJobListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async companyJobs(
    @Param('slug') slug: string,
    @Query() query: CompanyJobsQueryDto,
    @Lang() lang: Locale,
  ): Promise<Paginated<PublicJobListItem>> {
    const companyId = await this.companiesPublicService.approvedIdBySlug(slug, lang);
    return this.publicJobsService.listByCompany(companyId, query, lang);
  }
}
