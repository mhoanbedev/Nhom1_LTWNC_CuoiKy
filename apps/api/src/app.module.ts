import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_LOCALE } from '@ltwnc/shared';
import { I18nModule } from 'nestjs-i18n';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { localeMiddleware } from './common/middleware/locale.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { appConfig } from './config/app.config';
import { googleConfig } from './config/google.config';
import { rateLimitConfig } from './config/rate-limit.config';
import { buildThrottlerOptions } from './common/rate-limit/rate-limit';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MetaModule } from './modules/meta/meta.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Chạy từ apps/api nên đọc apps/api/.env; trên Render không có file, env lấy từ dashboard.
      envFilePath: '.env',
      validate: validateEnv,
      load: [appConfig, databaseConfig, jwtConfig, googleConfig, rateLimitConfig],
    }),
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LOCALE,
      // src/i18n khi chạy test (ts-jest), dist/i18n khi chạy bản build (nest-cli copy sang).
      loaderOptions: { path: join(__dirname, 'i18n'), watch: false },
      // Ngôn ngữ do localeMiddleware chọn và truyền tường minh khi dịch, nên không cần resolver.
      resolvers: [],
    }),
    ScheduleModule.forRoot(),
    // Guard không global: chỉ route gắn @AuthRateLimit/@LoginRateLimit bị giới hạn.
    ThrottlerModule.forRootAsync({
      inject: [rateLimitConfig.KEY],
      useFactory: (config: ConfigType<typeof rateLimitConfig>) => buildThrottlerOptions(config),
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    MetaModule,
  ],
  providers: [
    // Khai bằng APP_* thay vì app.useGlobal*() để chạy cả trong test e2e và dùng được DI.
    // Thứ tự guard: xác thực (JWT) trước, rồi vai trò. Mọi route cần đăng nhập trừ @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: AppZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware, localeMiddleware).forRoutes('*path');
  }
}
