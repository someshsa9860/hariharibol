import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { CacheService } from '@infrastructure/cache/cache.service';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [PrismaModule, CacheModule.register(), StorageModule],
  controllers: [BooksController],
  providers: [BooksService, CacheService],
  exports: [BooksService, CacheService],
})
export class BooksModule {}
