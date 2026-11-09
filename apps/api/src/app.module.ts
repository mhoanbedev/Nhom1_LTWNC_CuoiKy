import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.schema';

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
  ],
})
export class AppModule {}
