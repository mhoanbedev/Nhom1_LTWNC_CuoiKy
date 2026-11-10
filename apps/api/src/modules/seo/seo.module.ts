import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

/** Dữ liệu SEO chỉ đọc cho frontend: sitemap, generateStaticParams (mục 9 của đặc tả). */
@Module({
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
