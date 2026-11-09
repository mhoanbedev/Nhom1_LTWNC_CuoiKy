import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

/** Module cần upload file thì import module này. */
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
