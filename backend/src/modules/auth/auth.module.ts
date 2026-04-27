import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService, TokenService, OAuthService } from './services';
import { JwtGuard } from './guards/jwt.guard';

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
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, OAuthService, JwtGuard],
  exports: [AuthService, TokenService, JwtGuard],
})
export class AuthModule {}
