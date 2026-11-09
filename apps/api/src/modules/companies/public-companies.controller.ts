import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  LOCALES,
  type Locale,
  type Paginated,
  type PublicCompanyDetail,
  type PublicCompanyListItem,
} from '@ltwnc/shared';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import {
  PublicCompaniesQueryDto,
  PublicCompanyDetailDto,
  PublicCompanyListItemDto,
} from '../../common/swagger/public.dto';
import { CompaniesPublicService } from './companies-public.service';

@ApiTags('Public – Companies')
@ApiQuery({ name: 'lang', enum: LOCALES, required: false })
@Public()
@Controller('companies')
export class PublicCompaniesController {
  constructor(private readonly companiesPublicService: CompaniesPublicService) {}

  @Get()
  @ApiOperation({
    summary: 'Công ty đã duyệt, duyệt gần đây lên trước',
    description:
      'Lọc theo `q` (tên, gõ không dấu được), `industryId`, `locationId`; kèm số tin đang mở.',
  })
  @ApiPaginatedResponse(PublicCompanyListItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  list(
    @Query() query: PublicCompaniesQueryDto,
    @Lang() lang: Locale,
  ): Promise<Paginated<PublicCompanyListItem>> {
    return this.companiesPublicService.list(query, lang);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Trang công ty công khai',
    description:
      'Tìm theo slug ở bất kỳ ngôn ngữ nào. Chưa duyệt hoặc không có bản theo `lang`: 404. Slug khác `canonicalSlug` thì frontend redirect 308.',
  })
  @ApiDataResponse(PublicCompanyDetailDto)
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  detail(@Param('slug') slug: string, @Lang() lang: Locale): Promise<PublicCompanyDetail> {
    return this.companiesPublicService.detail(slug, lang);
  }
}
