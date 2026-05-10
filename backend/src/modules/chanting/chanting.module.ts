import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { ChantingService } from './chanting.service';
import { ChantingController } from './chanting.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ChantingController],
  providers: [ChantingService],
  exports: [ChantingService],
})
export class ChantingModule {}
