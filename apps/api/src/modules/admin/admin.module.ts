import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { AdminCompaniesController } from './admin-companies.controller';

/**
 * API quản trị (`/admin/*`, chỉ ADMIN). Controller ở đây chỉ nhận HTTP; nghiệp vụ nằm trong service
 * của module sở hữu dữ liệu (vd CompaniesAdminService thuộc module companies).
 */
@Module({
  imports: [CompaniesModule],
  controllers: [AdminCompaniesController],
})
export class AdminModule {}
