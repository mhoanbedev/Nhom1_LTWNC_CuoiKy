import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsersModule } from '../users/users.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminUsersController } from './admin-users.controller';

/**
 * API quản trị (`/admin/*`, chỉ ADMIN). Controller ở đây chỉ nhận HTTP; nghiệp vụ nằm trong service
 * của module sở hữu dữ liệu (vd CompaniesAdminService thuộc module companies).
 */
@Module({
  imports: [CompaniesModule, JobsModule, UsersModule, AuthModule],
  controllers: [AdminCompaniesController, AdminJobsController, AdminUsersController],
})
export class AdminModule {}
