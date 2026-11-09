import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { JobSkill } from './entities/job-skill.entity';
import { JobTranslation } from './entities/job-translation.entity';
import { PublicJobsController } from './public-jobs.controller';
import { PublicJobsService } from './public-jobs.service';
import { Job } from './entities/job.entity';
import { SavedJob } from './entities/saved-job.entity';
import { SavedJobsController } from './saved-jobs.controller';
import { SavedJobsService } from './saved-jobs.service';
import { JobExpiryService } from './job-expiry.service';
import { JobExpiryTask } from './job-expiry.task';
import { RecruiterJobsController } from './recruiter-jobs.controller';
import { RecruiterJobsService } from './recruiter-jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobTranslation, JobSkill, SavedJob]), CompaniesModule],
  controllers: [RecruiterJobsController, PublicJobsController, SavedJobsController],
  providers: [
    RecruiterJobsService,
    PublicJobsService,
    SavedJobsService,
    JobExpiryService,
    JobExpiryTask,
  ],
})
export class JobsModule {}
