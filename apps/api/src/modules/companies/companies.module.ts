import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { CompaniesService } from './companies.service';
import { CompanyTranslation } from './entities/company-translation.entity';
import { Company } from './entities/company.entity';
import { RecruiterCompanyController } from './recruiter-company.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyTranslation]), CloudinaryModule],
  controllers: [RecruiterCompanyController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
