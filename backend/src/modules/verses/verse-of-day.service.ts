import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AIProviderService } from '@infrastructure/ai/ai-provider.service';
import { StorageService } from '@infrastructure/storage/storage.service';
import { AppSettingsService } from '@infrastructure/config/app-settings.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

export interface VerseOfDayConfig {
  aiProvider: 'gemini' | 'openai' | 'none';
  apiKey?: string;
  autoGenerate: boolean;
  generateImage: boolean;
  selectedVerseId?: string;
}

@Injectable()
export class VerseOfDayService {
  private readonly logger = new Logger('VerseOfDayService');

  constructor(
    private prisma: PrismaService,
    private aiProvider: AIProviderService,
    private storageService: StorageService,
    private appSettings: AppSettingsService,
    private cacheService: CacheService,
    private configService: ConfigService,
  ) {}

  async getConfig(): Promise<VerseOfDayConfig> {
    try {
      // TODO: Fetch from settings table in database
      return {
        aiProvider: (this.configService.get('VOD_AI_PROVIDER') || 'gemini') as 'gemini' | 'openai' | 'none',
        autoGenerate: this.configService.get('VOD_AUTO_GENERATE') === 'true',
        generateImage: this.configService.get('VOD_GENERATE_IMAGE') === 'true',
      };
    } catch (error) {
      this.logger.error(`Failed to get config:`, error);
      return { aiProvider: 'none', autoGenerate: false, generateImage: false };
    }
  }

  async updateConfig(config: Partial<VerseOfDayConfig>): Promise<VerseOfDayConfig> {
    try {
      // TODO: Save to settings table in database (AppSettings model)
      // For now, this would update environment or a service variable
      // In production, create an AppSettings table to persist these values

      // If API key is provided, validate it before saving
      if (config.apiKey && config.aiProvider) {
        // Could validate key format here
        this.logger.log(`API key configured for provider: ${config.aiProvider}`);
      }

      const updatedConfig = await this.getConfig();
      this.logger.log('Config updated:', updatedConfig);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Failed to update config:`, error);
      throw error;
    }
  }

  async getTodayVerse(): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateKey = today.toISOString().split('T')[0];

      // Try cache first (24 hour TTL)
      return await this.cacheService.getOrSet(
        CacheService.buildVerseOfDayKey(dateKey),
        async () => {
          let verseOfDay = await this.prisma.verseOfDay.findFirst({
            where: {
              date: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              },
            },
            include: {
              verse: {
                select: {
                  id: true,
                  sanskrit: true,
                  transliteration: true,
                  meaning: true,
                  audioUrl: true,
                },
              },
            },
          });

          if (!verseOfDay) {
            const config = await this.getConfig();
            if (config.autoGenerate && config.aiProvider !== 'none') {
              verseOfDay = await this.generateVerseOfDay();
            } else {
              verseOfDay = await this.getRandomVerse();
            }
          }

          return verseOfDay;
        },
        24 * 60 * 60 * 1000, // 24 hour TTL
      );
    } catch (error) {
      this.logger.error(`Failed to get today's verse:`, error);
      throw error;
    }
  }

  async generateVerseOfDay(): Promise<any> {
    try {
      const config = await this.getConfig();

      if (config.aiProvider === 'none') {
        return this.getRandomVerse();
      }

      // Use AI to select a relevant verse
      const prompt = `Select the most meaningful Vedic verse for today's date. Consider themes of wisdom,
      spiritual growth, and relevance to daily life. Return only the verse ID and a brief explanation.`;

      const aiResponse = await this.aiProvider.generateText(prompt, config.aiProvider, {
        maxTokens: 200,
      });

      // Parse response to get verse ID (implement based on AI response format)
      const verses = await this.prisma.verse.findMany({ take: 100 });
      if (!verses.length) {
        throw new Error('No verses found in database');
      }
      const randomVerse = verses[Math.floor(Math.random() * verses.length)];

      let imageUrl = null;
      if (config.generateImage) {
        imageUrl = await this.generateVerseImage(randomVerse);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const verseOfDay = await this.prisma.verseOfDay.create({
        data: {
          date: today,
          verseId: randomVerse.id,
          imageUrl,
          aiGenerated: true,
          explanation: aiResponse,
        },
        include: { verse: true },
      });

      await this.notifyUsers(randomVerse);
      return verseOfDay;
    } catch (error) {
      this.logger.error(`Failed to generate verse of day:`, error);
      throw error;
    }
  }

  async selectVerseOfDay(verseId: string): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Remove existing verse of day if present
      await this.prisma.verseOfDay.deleteMany({
        where: {
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      const config = await this.getConfig();
      let imageUrl = null;

      const verse = await this.prisma.verse.findUnique({ where: { id: verseId } });
      if (!verse) {
        throw new BadRequestException(`Verse ${verseId} not found`);
      }

      if (config.generateImage) {
        imageUrl = await this.generateVerseImage(verse);
      }

      const verseOfDay = await this.prisma.verseOfDay.create({
        data: {
          date: today,
          verseId,
          imageUrl,
          aiGenerated: false,
        },
        include: { verse: true },
      });

      await this.notifyUsers(verse);
      return verseOfDay;
    } catch (error) {
      this.logger.error(`Failed to select verse of day:`, error);
      throw error;
    }
  }

  async generateVerseImage(verse: any): Promise<string> {
    try {
      const prompt = `Create a beautiful, spiritual image for this Vedic verse:
      "${verse.sanskrit || verse.transliteration}".
      Style: peaceful, meditative, gold and earth tones, intricate patterns.`;

      const imageBuffer = await this.aiProvider.generateImage(prompt, 'gemini');

      const filename = `verse-${verse.id}-${Date.now()}.webp`;
      const result = await this.storageService.uploadImage(
        imageBuffer,
        filename,
        'public/verses-of-day', // Public folder for accessible images
        'image/webp',
      );

      return result.url;
    } catch (error) {
      this.logger.error(`Failed to generate verse image:`, error);
      return null;
    }
  }

  async getVerseOfDayHistory(limit = 10): Promise<any[]> {
    try {
      return await this.prisma.verseOfDay.findMany({
        take: limit,
        orderBy: { date: 'desc' },
        include: { verse: true },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch history:`, error);
      return [];
    }
  }

  private async getRandomVerse(): Promise<any> {
    try {
      const verseCount = await this.prisma.verse.count();
      if (!verseCount) {
        throw new Error('No verses found in database');
      }
      const randomIndex = Math.floor(Math.random() * verseCount);

      const verse = await this.prisma.verse.findFirst({
        skip: randomIndex,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return await this.prisma.verseOfDay.create({
        data: {
          date: today,
          verseId: verse.id,
        },
        include: { verse: true },
      });
    } catch (error) {
      this.logger.error(`Failed to get random verse:`, error);
      throw error;
    }
  }

  private async notifyUsers(verse: any): Promise<void> {
    try {
      // Use FCM topic subscription
      await this.prisma.fcmTopic.findFirst({
        where: { name: 'verse-of-day' },
      });

      // Send topic notification
      // TODO: Implement FCM topic notification
      this.logger.log(`Notifying users about verse of day: ${verse.id}`);
    } catch (error) {
      this.logger.error(`Failed to notify users:`, error);
    }
  }
}
