import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { StorageProvider, UploadOptions, UploadResult } from '../storage.interface';
import { defaultImageVariants } from '../storage.config';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(private configService: ConfigService) {
    this.basePath = this.configService.get('STORAGE_LOCAL_PATH') || './uploads';
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const fullPath = path.join(this.basePath, options.folder);
    await fs.mkdir(fullPath, { recursive: true });

    const filename = this.sanitizeFilename(options.filename);
    const filePath = path.join(fullPath, filename);

    // Write file
    await fs.writeFile(filePath, options.buffer);

    const result: UploadResult = {
      url: `${options.folder}/${filename}`,
      path: filePath,
      filename,
      size: options.buffer.length,
      mimetype: options.mimetype,
    };

    // Generate image variants if requested
    if (options.generateVariants && this.isImage(options.mimetype)) {
      result.variants = await this.generateImageVariants(fullPath, filename);
    }

    return result;
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      // File doesn't exist, ignore
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const fullPath = path.join(this.basePath, folderPath);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
    } catch (err) {
      // Folder doesn't exist, ignore
    }
  }

  getUrl(filePath: string): string {
    return `/uploads/${filePath}`;
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private async generateImageVariants(
    folder: string,
    filename: string,
  ): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);

    try {
      const originalPath = path.join(folder, filename);
      const buffer = await fs.readFile(originalPath);

      // Generate sm variant
      const smBuffer = await sharp(buffer)
        .resize(defaultImageVariants.sm.width, defaultImageVariants.sm.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer();

      const smPath = path.join(folder, `${name}-sm.webp`);
      await fs.writeFile(smPath, smBuffer);
      variants.sm = `${name}-sm.webp`;

      // Generate md variant
      const mdBuffer = await sharp(buffer)
        .resize(defaultImageVariants.md.width, defaultImageVariants.md.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();

      const mdPath = path.join(folder, `${name}-md.webp`);
      await fs.writeFile(mdPath, mdBuffer);
      variants.md = `${name}-md.webp`;

      // Generate lg variant
      const lgBuffer = await sharp(buffer)
        .resize(defaultImageVariants.lg.width, defaultImageVariants.lg.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 90 })
        .toBuffer();

      const lgPath = path.join(folder, `${name}-lg.webp`);
      await fs.writeFile(lgPath, lgBuffer);
      variants.lg = `${name}-lg.webp`;
    } catch (err) {
      console.error('Failed to generate image variants:', err);
    }

    return variants;
  }

  private isImage(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();
  }
}
