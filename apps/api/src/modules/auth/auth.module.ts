import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { jwtConfig } from '../../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { AccountsService } from './accounts.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Account } from './entities/account.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { GoogleIdTokenVerifier } from './google/google-id-token.verifier';
import { PasswordService } from './password.service';
import { RefreshTokenCleanupTask } from './refresh-token-cleanup.task';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, RefreshToken]),
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.accessSecret,
        signOptions: { algorithm: 'HS256', expiresIn: config.accessTtlSeconds },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountsService,
    GoogleIdTokenVerifier,
    PasswordService,
    RefreshTokenService,
    RefreshTokenCleanupTask,
    JwtStrategy,
  ],
  exports: [RefreshTokenService],
})
export class AuthModule {}
