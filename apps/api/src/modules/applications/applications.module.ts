import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvsModule } from '../cvs/cvs.module';
import { Job } from '../jobs/entities/job.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { ApplicationsService } from './applications.service';
import { CandidateApplicationsController } from './candidate-applications.controller';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { Application } from './entities/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationStatusHistory, Job]),
    ProfilesModule,
    CvsModule,
    UsersModule,
  ],
  controllers: [CandidateApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
