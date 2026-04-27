import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import * as crypto from 'crypto';

export interface AppSetting {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  isEncrypted?: boolean;
  isPublic?: boolean;
}

@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger('AppSettingsService');
  private readonly encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY || 'default-key-change-in-production';
  private settingsCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) {
    this.initializeDefaultSettings();
  }

  private initializeDefaultSettings(): void {
    const defaultSettings: AppSetting[] = [
      {
        key: 'VOD_AI_PROVIDER',
        value: 'gemini',
        type: 'string',
        description: 'AI provider for verse of day generation',
        isPublic: true,
      },
      {
        key: 'VOD_AUTO_GENERATE',
        value: 'false',
        type: 'boolean',
        description: 'Auto-generate verse of day daily',
        isPublic: true,
      },
      {
        key: 'VOD_GENERATE_IMAGE',
        value: 'false',
        type: 'boolean',
        description: 'Generate images for verses',
        isPublic: true,
      },
      {
        key: 'GEMINI_API_KEY',
        value: process.env.GEMINI_API_KEY || '',
        type: 'string',
        description: 'Google Gemini API key',
        isEncrypted: true,
        isPublic: false,
      },
      {
        key: 'OPENAI_API_KEY',
        value: process.env.OPENAI_API_KEY || '',
        type: 'string',
        description: 'OpenAI API key',
        isEncrypted: true,
        isPublic: false,
      },
      {
        key: 'EMAIL_NOTIFICATIONS_ENABLED',
        value: 'true',
        type: 'boolean',
        description: 'Enable email notifications',
        isPublic: true,
      },
      {
        key: 'PUSH_NOTIFICATIONS_ENABLED',
        value: 'true',
        type: 'boolean',
        description: 'Enable push notifications',
        isPublic: true,
      },
    ];

    this.logger.debug(`Initialized ${defaultSettings.length} default settings`);
  }

  async getSetting(key: string, useCache = true): Promise<any> {
    try {
      // Check cache first
      if (useCache) {
        const cached = this.settingsCache.get(key);
        const expiry = this.cacheExpiry.get(key);

        if (cached !== undefined && expiry && expiry > Date.now()) {
          return cached;
        }
      }

      // Fetch from database
      const setting = await this.prisma.appSettings.findUnique({
        where: { key },
      });

      if (!setting) {
        this.logger.warn(`Setting not found: ${key}`);
        return null;
      }

      let value = setting.value;

      // Decrypt if needed
      if (setting.isEncrypted) {
        value = this.decrypt(value);
      }

      // Parse based on type
      value = this.parseValue(value, setting.type);

      // Cache the value
      if (useCache) {
        this.settingsCache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
      }

      return value;
    } catch (error) {
      this.logger.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  }

  async getSettings(keys: string[], useCache = true): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const key of keys) {
      result[key] = await this.getSetting(key, useCache);
    }

    return result;
  }

  async setSetting(setting: AppSetting): Promise<boolean> {
    try {
      let value = String(setting.value);

      // Encrypt if needed
      if (setting.isEncrypted) {
        value = this.encrypt(value);
      }

      await this.prisma.appSettings.upsert({
        where: { key: setting.key },
        create: {
          key: setting.key,
          value,
          type: setting.type,
          description: setting.description,
          isEncrypted: setting.isEncrypted || false,
          isPublic: setting.isPublic || false,
        },
        update: {
          value,
          type: setting.type,
          description: setting.description,
          isEncrypted: setting.isEncrypted || false,
          isPublic: setting.isPublic || false,
        },
      });

      // Invalidate cache
      this.settingsCache.delete(setting.key);
      this.cacheExpiry.delete(setting.key);

      this.logger.log(`Setting updated: ${setting.key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set setting ${setting.key}:`, error);
      return false;
    }
  }

  async getAllPublicSettings(): Promise<Record<string, any>> {
    try {
      const settings = await this.prisma.appSettings.findMany({
        where: { isPublic: true },
      });

      const result: Record<string, any> = {};

      for (const setting of settings) {
        result[setting.key] = this.parseValue(setting.value, setting.type);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get public settings:', error);
      return {};
    }
  }

  async deleteSetting(key: string): Promise<boolean> {
    try {
      await this.prisma.appSettings.delete({
        where: { key },
      });

      // Invalidate cache
      this.settingsCache.delete(key);
      this.cacheExpiry.delete(key);

      this.logger.log(`Setting deleted: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete setting ${key}:`, error);
      return false;
    }
  }

  clearCache(): void {
    this.settingsCache.clear();
    this.cacheExpiry.clear();
    this.logger.log('Settings cache cleared');
  }

  private encrypt(value: string): string {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      return value;
    }
  }

  private decrypt(value: string): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(value, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      return value;
    }
  }

  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'number':
        return Number(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'string':
      default:
        return value;
    }
  }
}
