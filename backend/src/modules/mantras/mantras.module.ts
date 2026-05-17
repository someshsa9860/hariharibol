import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { CacheService } from '@infrastructure/cache/cache.service';
import { AuthModule } from '../auth/auth.module';
import { MantrasController } from './mantras.controller';
import { MantrasService } from './mantras.service';

@Module({
  imports: [PrismaModule, AuthModule, CacheModule.register()],
  controllers: [MantrasController],
  providers: [MantrasService, CacheService],
  exports: [MantrasService, CacheService],
})
export class MantrasModule {}
