import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvsModule } from '../cvs/cvs.module';
import { Job } from '../jobs/entities/job.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { ApplicationTransitionService } from './application-transition.service';
import { ApplicationsService } from './applications.service';
import { CandidateApplicationsController } from './candidate-applications.controller';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';
import { RecruiterApplicationsController } from './recruiter-applications.controller';
import { RecruiterApplicationsService } from './recruiter-applications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationStatusHistory, Job]),
    ProfilesModule,
    CvsModule,
    UsersModule,
  ],
  controllers: [CandidateApplicationsController, RecruiterApplicationsController],
  providers: [ApplicationsService, RecruiterApplicationsService, ApplicationTransitionService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
