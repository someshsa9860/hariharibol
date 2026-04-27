import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';
import { StorageProvider, UploadOptions, UploadResult } from '../storage.interface';
import { defaultImageVariants } from '../storage.config';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private s3: AWS.S3;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET');

    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION') || 'us-east-1',
    });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const filename = this.sanitizeFilename(options.filename);
    const key = `${options.folder}/${filename}`;

    // Upload original file
    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer,
        ContentType: options.mimetype,
        ACL: 'public-read',
      })
      .promise();

    const result: UploadResult = {
      url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
      path: key,
      filename,
      size: options.buffer.length,
      mimetype: options.mimetype,
    };

    // Generate image variants if requested
    if (options.generateVariants && this.isImage(options.mimetype)) {
      result.variants = await this.generateImageVariants(
        options.folder,
        filename,
        options.buffer,
      );
    }

    return result;
  }

  async delete(filePath: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucket,
          Key: filePath,
        })
        .promise();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    try {
      const objects = await this.s3
        .listObjectsV2({
          Bucket: this.bucket,
          Prefix: folderPath,
        })
        .promise();

      if (!objects.Contents || objects.Contents.length === 0) return;

      const deleteParams = {
        Bucket: this.bucket,
        Delete: {
          Objects: objects.Contents.map((obj) => ({ Key: obj.Key })),
        },
      };

      await this.s3.deleteObjects(deleteParams).promise();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  }

  getUrl(filePath: string): string {
    return `https://${this.bucket}.s3.amazonaws.com/${filePath}`;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucket,
          Key: filePath,
        })
        .promise();
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

    try {
      // Generate sm variant
      const smBuffer = await sharp(buffer)
        .resize(defaultImageVariants.sm.width, defaultImageVariants.sm.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer();

      const smKey = `${folder}/${name}-sm.webp`;
      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: smKey,
          Body: smBuffer,
          ContentType: 'image/webp',
          ACL: 'public-read',
        })
        .promise();
      variants.sm = `${name}-sm.webp`;

      // Generate md variant
      const mdBuffer = await sharp(buffer)
        .resize(defaultImageVariants.md.width, defaultImageVariants.md.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();

      const mdKey = `${folder}/${name}-md.webp`;
      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: mdKey,
          Body: mdBuffer,
          ContentType: 'image/webp',
          ACL: 'public-read',
        })
        .promise();
      variants.md = `${name}-md.webp`;

      // Generate lg variant
      const lgBuffer = await sharp(buffer)
        .resize(defaultImageVariants.lg.width, defaultImageVariants.lg.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 90 })
        .toBuffer();

      const lgKey = `${folder}/${name}-lg.webp`;
      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: lgKey,
          Body: lgBuffer,
          ContentType: 'image/webp',
          ACL: 'public-read',
        })
        .promise();
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
