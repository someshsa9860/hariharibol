import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import sharp from 'sharp';
import { StorageProvider, UploadOptions, UploadResult } from '../storage.interface';
import { defaultImageVariants } from '../storage.config';

// Bucket has BlockPublicAcls=true — no ACL on uploads.
// Files are private; use getSignedUrl() to serve them.
const PRESIGNED_URL_TTL = 60 * 60; // 1 hour

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private s3: AWS.S3;
  private bucket: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('S3_BUCKET');
    this.region = this.configService.get('S3_REGION') || 'ap-south-1';

    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.region,
    });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const filename = this.sanitizeFilename(options.filename);
    const key = `${options.folder}/${filename}`;

    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer,
        ContentType: options.mimetype,
      })
      .promise();

    const result: UploadResult = {
      url: this.getUrl(key),
      path: key,
      filename,
      size: options.buffer.length,
      mimetype: options.mimetype,
    };

    if (options.generateVariants && this.isImage(options.mimetype)) {
      result.variants = await this.generateImageVariants(options.folder, filename, options.buffer);
    }

    return result;
  }

  async delete(filePath: string): Promise<void> {
    try {
      await this.s3.deleteObject({ Bucket: this.bucket, Key: filePath }).promise();
    } catch (err) {
      console.error('S3 delete failed:', err);
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    try {
      const objects = await this.s3
        .listObjectsV2({ Bucket: this.bucket, Prefix: folderPath })
        .promise();

      if (!objects.Contents?.length) return;

      await this.s3
        .deleteObjects({
          Bucket: this.bucket,
          Delete: { Objects: objects.Contents.map((o) => ({ Key: o.Key })) },
        })
        .promise();
    } catch (err) {
      console.error('S3 deleteFolder failed:', err);
    }
  }

  // Returns a presigned URL valid for 1 hour.
  // Store the S3 key (path) in DB — generate fresh URLs at serve time.
  getUrl(filePath: string): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: filePath,
      Expires: PRESIGNED_URL_TTL,
    });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.s3.headObject({ Bucket: this.bucket, Key: filePath }).promise();
      return true;
    } catch {
      return false;
    }
  }

  private async generateImageVariants(
    folder: string,
    filename: string,
    buffer: Buffer,
  ): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};
    const name = filename.substring(0, filename.lastIndexOf('.'));

    const configs = [
      { suffix: 'sm', ...defaultImageVariants.sm, quality: 80 },
      { suffix: 'md', ...defaultImageVariants.md, quality: 85 },
      { suffix: 'lg', ...defaultImageVariants.lg, quality: 90 },
    ];

    for (const cfg of configs) {
      try {
        const resized = await sharp(buffer)
          .resize(cfg.width, cfg.height, { fit: 'cover', position: 'center' })
          .webp({ quality: cfg.quality })
          .toBuffer();

        const variantKey = `${folder}/${name}-${cfg.suffix}.webp`;
        await this.s3
          .putObject({
            Bucket: this.bucket,
            Key: variantKey,
            Body: resized,
            ContentType: 'image/webp',
          })
          .promise();

        variants[cfg.suffix] = `${name}-${cfg.suffix}.webp`;
      } catch (err) {
        console.error(`Failed to generate ${cfg.suffix} variant:`, err);
      }
    }

    return variants;
  }

  private isImage(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  }
}
