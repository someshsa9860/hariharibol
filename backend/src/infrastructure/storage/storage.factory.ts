import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Injectable()
export class StorageFactory {
  private provider: StorageProvider;

  constructor(
    private configService: ConfigService,
    private localProvider: LocalStorageProvider,
    private s3Provider: S3StorageProvider,
  ) {
    this.initializeProvider();
  }

  private initializeProvider() {
    const storageProvider = this.configService.get('STORAGE_PROVIDER') || 'local';

    if (storageProvider === 's3') {
      this.provider = this.s3Provider;
    } else {
      this.provider = this.localProvider;
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }
}
