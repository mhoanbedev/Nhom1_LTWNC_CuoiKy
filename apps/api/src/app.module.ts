import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Chạy từ apps/api nên đọc apps/api/.env; trên Render không có file, env lấy từ dashboard.
      envFilePath: '.env',
      validate: validateEnv,
      load: [appConfig, databaseConfig],
    }),
    DatabaseModule,
  ],
})
export class AppModule {}
