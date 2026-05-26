import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infrastructure/database/prisma.service';
import * as AWS from 'aws-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3: AWS.S3;
  private readonly backupDir = '/tmp/db-backups';

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION') || 'us-east-1',
    });

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Daily backup at 2 AM (night backup)
   * Cron: 0 2 * * * (2:00 AM every day)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async nightlyBackup(): Promise<void> {
    try {
      this.logger.log('Starting nightly database backup...');
      await this.performBackup('nightly');
      this.logger.log('Nightly backup completed successfully');
    } catch (error) {
      this.logger.error('Nightly backup failed', error);
      // You can add error notification here
    }
  }

  /**
   * Afternoon backup at 4:30 PM
   * Cron: 30 16 * * * (16:30 = 4:30 PM every day)
   */
  @Cron('30 16 * * *')
  async afternoonBackup(): Promise<void> {
    try {
      this.logger.log('Starting afternoon database backup...');
      await this.performBackup('afternoon');
      this.logger.log('Afternoon backup completed successfully');
    } catch (error) {
      this.logger.error('Afternoon backup failed', error);
      // You can add error notification here
    }
  }

  /**
   * Perform database backup and upload to S3
   */
  private async performBackup(backupType: 'nightly' | 'afternoon'): Promise<void> {
    const timestamp = this.getFormattedTimestamp();
    const backupFileName = `hariharibol-db-${backupType}-${timestamp}.sql.gz`;
    const backupFilePath = path.join(this.backupDir, backupFileName);
    const s3Key = `database-backups/${backupType}/${timestamp}/${backupFileName}`;

    try {
      // Step 1: Get database URL from environment or Prisma
      const databaseUrl = this.configService.get('DATABASE_URL');

      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      this.logger.debug(`Creating database dump: ${backupFilePath}`);

      // Step 2: Create compressed database dump using pg_dump
      const dumpCommand = `pg_dump "${databaseUrl}" | gzip > "${backupFilePath}"`;
      execSync(dumpCommand, { stdio: 'pipe' });

      // Step 3: Verify backup file was created and has size > 0
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file was not created at ${backupFilePath}`);
      }

      const fileStats = fs.statSync(backupFilePath);
      if (fileStats.size === 0) {
        throw new Error('Backup file is empty');
      }

      this.logger.debug(
        `Backup file created: ${backupFileName} (${this.formatBytes(fileStats.size)})`,
      );

      // Step 4: Upload to S3
      await this.uploadToS3(backupFilePath, s3Key, backupFileName, fileStats.size);

      // Step 5: Clean up local backup file
      fs.unlinkSync(backupFilePath);
      this.logger.log(`Backup uploaded to S3: s3://${this.getBucketName()}/${s3Key}`);

      // Step 6: Cleanup old backups (keep last 7 days)
      await this.cleanupOldBackups(backupType);
    } catch (error) {
      this.logger.error(`Backup failed for ${backupType}: ${error.message}`, error.stack);
      // Clean up partial backup file if exists
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
      throw error;
    }
  }

  /**
   * Upload backup file to S3
   */
  private async uploadToS3(
    filePath: string,
    s3Key: string,
    fileName: string,
    fileSize: number,
  ): Promise<void> {
    const fileContent = fs.readFileSync(filePath);

    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.getBucketName(),
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/gzip',
      Metadata: {
        'backup-type': 'database',
        'backup-date': new Date().toISOString(),
        'file-size': fileSize.toString(),
      },
      // Enable server-side encryption
      ServerSideEncryption: 'AES256',
      // Add tags for easier management
      Tagging: `backup-type=database&app=hariharibol&date=${new Date().toISOString().split('T')[0]}`,
    };

    return new Promise((resolve, reject) => {
      this.s3.upload(params, (error: Error, data: AWS.S3.ManagedUpload.SendData) => {
        if (error) {
          this.logger.error(`S3 upload failed: ${error.message}`);
          reject(error);
        } else {
          this.logger.debug(`S3 upload successful: ${data.Location}`);
          resolve();
        }
      });
    });
  }

  /**
   * List and cleanup backups older than 7 days
   */
  private async cleanupOldBackups(backupType: 'nightly' | 'afternoon'): Promise<void> {
    const bucketName = this.getBucketName();
    const prefix = `database-backups/${backupType}/`;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const listParams: AWS.S3.ListObjectsV2Request = {
        Bucket: bucketName,
        Prefix: prefix,
      };

      const listedObjects = await this.s3.listObjectsV2(listParams).promise();

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      const objectsToDelete: AWS.S3.ObjectIdentifier[] = [];

      for (const object of listedObjects.Contents) {
        if (object.LastModified && object.LastModified < sevenDaysAgo) {
          objectsToDelete.push({ Key: object.Key });
          this.logger.log(`Marking for deletion: ${object.Key}`);
        }
      }

      if (objectsToDelete.length === 0) {
        return;
      }

      // Delete old backups in batches (S3 has a limit of 1000 objects per delete request)
      for (let i = 0; i < objectsToDelete.length; i += 1000) {
        const batch = objectsToDelete.slice(i, i + 1000);
        const deleteParams: AWS.S3.DeleteObjectsRequest = {
          Bucket: bucketName,
          Delete: { Objects: batch },
        };

        await this.s3.deleteObjects(deleteParams).promise();
        this.logger.log(`Deleted ${batch.length} old backup objects`);
      }
    } catch (error) {
      this.logger.warn(`Cleanup of old backups failed: ${error.message}`);
      // Don't throw - backup was successful, cleanup failure shouldn't block
    }
  }

  /**
   * Manual backup trigger (can be called via API)
   */
  async manualBackup(backupType: string = 'manual'): Promise<{
    success: boolean;
    message: string;
    fileName?: string;
  }> {
    try {
      await this.performBackup(backupType as any);
      return {
        success: true,
        message: `${backupType} backup completed successfully`,
      };
    } catch (error) {
      this.logger.error(`Manual backup failed: ${error.message}`);
      return {
        success: false,
        message: `Backup failed: ${error.message}`,
      };
    }
  }

  /**
   * Get backup status and last backup time
   */
  async getBackupStatus(): Promise<{
    lastNightlyBackup?: Date;
    lastAfternoonBackup?: Date;
    totalBackups: number;
  }> {
    const bucketName = this.getBucketName();

    try {
      const listParams: AWS.S3.ListObjectsV2Request = {
        Bucket: bucketName,
        Prefix: 'database-backups/',
      };

      const listedObjects = await this.s3.listObjectsV2(listParams).promise();
      const contents = listedObjects.Contents || [];

      let lastNightlyBackup: Date | undefined;
      let lastAfternoonBackup: Date | undefined;

      for (const object of contents) {
        if (object.Key.includes('/nightly/') && object.LastModified) {
          if (!lastNightlyBackup || object.LastModified > lastNightlyBackup) {
            lastNightlyBackup = object.LastModified;
          }
        }
        if (object.Key.includes('/afternoon/') && object.LastModified) {
          if (!lastAfternoonBackup || object.LastModified > lastAfternoonBackup) {
            lastAfternoonBackup = object.LastModified;
          }
        }
      }

      return {
        lastNightlyBackup,
        lastAfternoonBackup,
        totalBackups: contents.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get backup status: ${error.message}`);
      return { totalBackups: 0 };
    }
  }

  /**
   * Helper: Get S3 bucket name from config
   */
  private getBucketName(): string {
    return this.configService.get('AWS_S3_BACKUP_BUCKET') || 'hariharibol-backups';
  }

  /**
   * Helper: Format timestamp for backup filename
   */
  private getFormattedTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  }

  /**
   * Helper: Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
