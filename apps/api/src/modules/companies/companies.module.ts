import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompaniesAdminService } from './companies-admin.service';
import { CompaniesPublicService } from './companies-public.service';
import { CompaniesService } from './companies.service';
import { CompanyTranslation } from './entities/company-translation.entity';
import { Company } from './entities/company.entity';
import { PublicCompaniesController } from './public-companies.controller';
import { RecruiterCompanyController } from './recruiter-company.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyTranslation]),
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [RecruiterCompanyController, PublicCompaniesController],
  providers: [CompaniesService, CompaniesAdminService, CompaniesPublicService],
  exports: [CompaniesService, CompaniesAdminService, CompaniesPublicService],
})
export class CompaniesModule {}
