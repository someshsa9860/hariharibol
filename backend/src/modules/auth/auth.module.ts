import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService, TokenService, OAuthService } from './services';
import { JwtGuard } from './guards/jwt.guard';

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_EXPIRY') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'login',
          ttl: 60000,
          limit: 10,
        },
        {
          name: 'refresh',
          ttl: 60000,
          limit: 3,
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, OAuthService, JwtGuard],
  exports: [AuthService, TokenService, JwtGuard, JwtModule],
})
export class AuthModule {}
