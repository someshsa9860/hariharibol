import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AppSettingsService } from './app-settings.service';

@Module({
  imports: [NestConfigModule, PrismaModule],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class ConfigModule {}
