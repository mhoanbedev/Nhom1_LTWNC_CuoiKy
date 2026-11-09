import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  LOCALES,
  type IndustryItem,
  type Locale,
  type LocationItem,
  type SkillItem,
} from '@ltwnc/shared';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiDataResponse } from '../../common/swagger/api-response.decorators';
import { IndustryItemDto, LocationItemDto, SkillItemDto } from './dto/meta.dto';
import { MetaService } from './meta.service';

/** Danh mục ít đổi: cho trình duyệt và Next cache 1 ngày (mục 9 của đặc tả). */
const CACHE_ONE_DAY = 'public, max-age=86400';

@ApiTags('Meta')
@ApiQuery({ name: 'lang', enum: LOCALES, required: false })
@Public()
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('skills')
  @Header('Cache-Control', CACHE_ONE_DAY)
  @ApiOperation({ summary: 'Danh sách kỹ năng, xếp theo tên' })
  @ApiDataResponse(SkillItemDto, { isArray: true })
  skills(@Lang() lang: Locale): Promise<SkillItem[]> {
    return this.metaService.listSkills(lang);
  }

  @Get('industries')
  @Header('Cache-Control', CACHE_ONE_DAY)
  @ApiOperation({ summary: 'Danh sách ngành, xếp theo tên' })
  @ApiDataResponse(IndustryItemDto, { isArray: true })
  industries(@Lang() lang: Locale): Promise<IndustryItem[]> {
    return this.metaService.listIndustries(lang);
  }

  @Get('locations')
  @Header('Cache-Control', CACHE_ONE_DAY)
  @ApiOperation({ summary: 'Danh sách 34 tỉnh/thành, xếp theo tên' })
  @ApiDataResponse(LocationItemDto, { isArray: true })
  locations(@Lang() lang: Locale): Promise<LocationItem[]> {
    return this.metaService.listLocations(lang);
  }
}
