import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppZodValidationPipe } from './common/pipes/zod-validation.pipe';
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
  providers: [
    // Khai bằng APP_* thay vì app.useGlobal*() để chạy cả trong test e2e và dùng được DI.
    { provide: APP_PIPE, useClass: AppZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*path');
  }
}
