import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger('AppSettingsService');

  constructor(private prisma: PrismaService) {}

  async get(key: string, defaultValue?: string): Promise<string | undefined> {
    try {
      const setting = await this.prisma.appSettings.findUnique({ where: { key } });
      return setting?.value ?? defaultValue;
    } catch (error) {
      this.logger.error(`Failed to get setting "${key}":`, error);
      return defaultValue;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.prisma.appSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    } catch (error) {
      this.logger.error(`Failed to set setting "${key}":`, error);
      throw error;
    }
  }
}
