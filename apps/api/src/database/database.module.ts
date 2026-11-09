import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        ...buildDataSourceOptions(config.url),
        // Mặc định thử lại 9 lần; giảm xuống để quên bật Docker thì báo lỗi nhanh.
        retryAttempts: 3,
        retryDelay: 2000,
      }),
    }),
  ],
})
export class DatabaseModule {}
