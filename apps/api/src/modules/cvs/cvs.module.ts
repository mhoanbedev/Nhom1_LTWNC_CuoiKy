import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { CvsController } from './cvs.controller';
import { CvsService } from './cvs.service';
import { CvFile } from './entities/cv-file.entity';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CvFile]), CloudinaryModule],
  controllers: [CvsController, FilesController],
  providers: [CvsService],
  exports: [CvsService],
})
export class CvsModule {}
