import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Industry } from './entities/industry.entity';
import { Location } from './entities/location.entity';
import { Skill } from './entities/skill.entity';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  imports: [TypeOrmModule.forFeature([Skill, Industry, Location])],
  controllers: [MetaController],
  providers: [MetaService],
})
export class MetaModule {}
