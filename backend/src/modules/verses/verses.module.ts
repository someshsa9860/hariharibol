import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AIProviderModule } from '@infrastructure/ai/ai-provider.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { CacheModule } from '@nestjs/cache-manager';
import { VersesController } from './verses.controller';
import { VersesService } from './verses.service';
import { VerseOfDayController } from './verse-of-day.controller';
import { VerseOfDayService } from './verse-of-day.service';
import { VerseOfDayScheduler } from './verse-of-day.scheduler';
import { AppSettingsService } from './app-settings.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { PaginationService } from '@common/services/pagination.service';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, AIProviderModule, StorageModule, CacheModule.register(), NotificationsModule],
  controllers: [VersesController, VerseOfDayController],
  providers: [VersesService, VerseOfDayService, VerseOfDayScheduler, AppSettingsService, CacheService, PaginationService],
  exports: [VersesService, VerseOfDayService, AppSettingsService, CacheService, PaginationService],
})
export class VersesModule {}
