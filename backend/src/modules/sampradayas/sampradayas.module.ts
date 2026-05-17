import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { CacheService } from '@infrastructure/cache/cache.service';
import { AuthModule } from '../auth/auth.module';
import { SampradayasController } from './sampradayas.controller';
import { SampradayasService } from './sampradayas.service';

@Module({
  imports: [PrismaModule, AuthModule, CacheModule.register()],
  controllers: [SampradayasController],
  providers: [SampradayasService, CacheService],
  exports: [SampradayasService, CacheService],
})
export class SampradayasModule {}
