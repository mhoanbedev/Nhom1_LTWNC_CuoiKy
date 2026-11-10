import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SitemapEntry, StaticParam } from '@ltwnc/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/swagger/api-response.decorators';
import { SeoStaticParamsQueryDto, SitemapEntryDto, StaticParamDto } from './dto/seo.dto';
import { SeoService } from './seo.service';

@ApiTags('SEO')
@Public()
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('sitemap')
  @ApiOperation({
    summary: 'Dữ liệu cho sitemap.xml',
    description:
      'Mọi tin đang công khai (PUBLISHED, không ẩn, còn hạn, công ty đã duyệt) và mọi công ty đã duyệt. Mỗi trang kèm các bản ngôn ngữ đã có; frontend sinh một URL cho mỗi bản.',
  })
  @ApiDataResponse(SitemapEntryDto, { isArray: true })
  sitemap(): Promise<SitemapEntry[]> {
    return this.seoService.sitemap();
  }

  @Get('static-params')
  @ApiOperation({
    summary: 'Tham số cho generateStaticParams',
    description:
      '`limit` tin mới đăng nhất (`type=job`) hoặc công ty mới duyệt nhất (`type=company`), mỗi bản dịch một cặp `{ locale, slug }`. Trang không có ở đây vẫn được ISR render khi có người vào.',
  })
  @ApiDataResponse(StaticParamDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  staticParams(@Query() query: SeoStaticParamsQueryDto): Promise<StaticParam[]> {
    return this.seoService.staticParams(query.type, query.limit);
  }
}
