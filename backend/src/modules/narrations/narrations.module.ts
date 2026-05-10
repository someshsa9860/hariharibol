import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NarrationsController } from './narrations.controller';
import { NarrationsService } from './narrations.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NarrationsController],
  providers: [NarrationsService],
  exports: [NarrationsService],
})
export class NarrationsModule {}
