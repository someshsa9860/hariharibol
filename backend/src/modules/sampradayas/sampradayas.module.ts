import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SampradayasController } from './sampradayas.controller';
import { SampradayasService } from './sampradayas.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SampradayasController],
  providers: [SampradayasService],
  exports: [SampradayasService],
})
export class SampradayasModule {}
