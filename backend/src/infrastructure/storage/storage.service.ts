import { Injectable, Logger } from '@nestjs/common';
import { StorageFactory } from './storage.factory';
import { UploadOptions, UploadResult } from './storage.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');

  constructor(private storageFactory: StorageFactory) {}

  async uploadImage(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimetype: string,
  ): Promise<UploadResult> {
    try {
      const provider = this.storageFactory.getProvider();
      const options: UploadOptions = {
        buffer,
        filename,
        folder,
        mimetype,
        generateVariants: true,
      };

      const result = await provider.upload(options);
      this.logger.log(`Image uploaded: ${filename} to ${folder}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to upload image: ${filename}`, error);
      throw error;
    }
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimetype: string,
  ): Promise<UploadResult> {
    try {
      const provider = this.storageFactory.getProvider();
      const options: UploadOptions = {
        buffer,
        filename,
        folder,
        mimetype,
        generateVariants: false,
      };

      const result = await provider.upload(options);
      this.logger.log(`File uploaded: ${filename} to ${folder}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${filename}`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const provider = this.storageFactory.getProvider();
      await provider.delete(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    try {
      const provider = this.storageFactory.getProvider();
      await provider.deleteFolder(folderPath);
      this.logger.log(`Folder deleted: ${folderPath}`);
    } catch (error) {
      this.logger.error(`Failed to delete folder: ${folderPath}`, error);
      throw error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const provider = this.storageFactory.getProvider();
      return await provider.exists(filePath);
    } catch (error) {
      this.logger.error(`Failed to check file existence: ${filePath}`, error);
      return false;
    }
  }

  getFileUrl(filePath: string): string {
    const provider = this.storageFactory.getProvider();
    return provider.getUrl(filePath);
  }
}
