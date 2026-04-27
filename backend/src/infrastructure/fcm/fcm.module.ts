import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { FCMService } from './fcm.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [FCMService],
  exports: [FCMService],
})
export class FCMModule {}
