import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageFactory } from './storage.factory';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  imports: [ConfigModule],
  providers: [StorageFactory, LocalStorageProvider, S3StorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
