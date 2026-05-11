import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AIProviderService } from '@infrastructure/ai/ai-provider.service';
import { StorageService } from '@infrastructure/storage/storage.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface VerseOfDayConfig {
  aiProvider: 'gemini' | 'openai' | 'none';
  apiKey?: string;
  autoGenerate: boolean;
  generateImage: boolean;
  selectedVerseId?: string;
}

const SETTINGS_KEYS = {
  AI_PROVIDER: 'vod_ai_provider',
  AUTO_GENERATE: 'vod_auto_generate',
  GENERATE_IMAGE: 'vod_generate_image',
};

@Injectable()
export class VerseOfDayService {
  private readonly logger = new Logger('VerseOfDayService');

  constructor(
    private prisma: PrismaService,
    private aiProvider: AIProviderService,
    private storageService: StorageService,
    private cacheService: CacheService,
    private notifications: NotificationsService,
  ) {}

  // ── Config via AppSettings table ─────────────────────────────────────────

  async getConfig(): Promise<VerseOfDayConfig> {
    try {
      const settings = await this.prisma.appSettings.findMany({
        where: { key: { in: Object.values(SETTINGS_KEYS) } },
      });

      const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

      return {
        aiProvider: (map[SETTINGS_KEYS.AI_PROVIDER] || 'gemini') as 'gemini' | 'openai' | 'none',
        autoGenerate: map[SETTINGS_KEYS.AUTO_GENERATE] === 'true',
        generateImage: map[SETTINGS_KEYS.GENERATE_IMAGE] === 'true',
      };
    } catch (error) {
      this.logger.error(`Failed to get config:`, error);
      return { aiProvider: 'none', autoGenerate: false, generateImage: false };
    }
  }

  async updateConfig(config: Partial<VerseOfDayConfig>): Promise<VerseOfDayConfig> {
    try {
      const updates: { key: string; value: string; description: string }[] = [];

      if (config.aiProvider !== undefined) {
        updates.push({ key: SETTINGS_KEYS.AI_PROVIDER, value: config.aiProvider, description: 'VoD AI provider' });
      }
      if (config.autoGenerate !== undefined) {
        updates.push({ key: SETTINGS_KEYS.AUTO_GENERATE, value: String(config.autoGenerate), description: 'VoD auto-generate' });
      }
      if (config.generateImage !== undefined) {
        updates.push({ key: SETTINGS_KEYS.GENERATE_IMAGE, value: String(config.generateImage), description: 'VoD generate image' });
      }

      await Promise.all(
        updates.map((u) =>
          this.prisma.appSettings.upsert({
            where: { key: u.key },
            create: { key: u.key, value: u.value, description: u.description },
            update: { value: u.value },
          }),
        ),
      );

      this.logger.log('VoD config updated');
      return this.getConfig();
    } catch (error) {
      this.logger.error(`Failed to update config:`, error);
      throw error;
    }
  }

  // ── Today's verse ─────────────────────────────────────────────────────────

  async getTodayVerse(): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateKey = today.toISOString().split('T')[0];

      return await this.cacheService.getOrSet(
        CacheService.buildVerseOfDayKey(dateKey),
        async () => {
          let verseOfDay = await this.prisma.verseOfDay.findFirst({
            where: {
              date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
            },
            include: {
              verse: {
                select: { id: true, sanskrit: true, transliteration: true, meaning: true, audioUrl: true },
              },
            },
          });

          if (!verseOfDay) {
            const config = await this.getConfig();
            verseOfDay =
              config.autoGenerate && config.aiProvider !== 'none'
                ? await this.generateVerseOfDay()
                : await this.getRandomVerse();
          }

          return verseOfDay;
        },
        24 * 60 * 60 * 1000,
      );
    } catch (error) {
      this.logger.error(`Failed to get today's verse:`, error);
      throw error;
    }
  }

  // ── AI generation ─────────────────────────────────────────────────────────

  async generateVerseOfDay(): Promise<any> {
    try {
      const config = await this.getConfig();

      if (config.aiProvider === 'none') return this.getRandomVerse();

      const prompt = `Select the most meaningful Vedic verse for today. Return only the verse ID and a brief explanation.`;
      const aiResponse = await this.aiProvider.generateText(prompt, config.aiProvider, { maxTokens: 200 });

      const verses = await this.prisma.verse.findMany({ take: 100 });
      if (!verses.length) throw new Error('No verses found in database');

      const randomVerse = verses[Math.floor(Math.random() * verses.length)];

      let imageUrl: string | null = null;
      if (config.generateImage) {
        imageUrl = await this.generateVerseImage(randomVerse);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const verseOfDay = await this.prisma.verseOfDay.create({
        data: { date: today, verseId: randomVerse.id, imageUrl, aiGenerated: true, explanation: aiResponse },
        include: { verse: true },
      });

      await this.dispatchVerseOfDayNotifications(randomVerse);
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

      await this.prisma.verseOfDay.deleteMany({
        where: { date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
      });

      const verse = await this.prisma.verse.findUnique({ where: { id: verseId } });
      if (!verse) throw new BadRequestException(`Verse ${verseId} not found`);

      const config = await this.getConfig();
      let imageUrl: string | null = null;
      if (config.generateImage) {
        imageUrl = await this.generateVerseImage(verse);
      }

      const verseOfDay = await this.prisma.verseOfDay.create({
        data: { date: today, verseId, imageUrl, aiGenerated: false },
        include: { verse: true },
      });

      await this.dispatchVerseOfDayNotifications(verse);
      return verseOfDay;
    } catch (error) {
      this.logger.error(`Failed to select verse of day:`, error);
      throw error;
    }
  }

  async generateVerseImage(verse: any): Promise<string | null> {
    try {
      const prompt = `Create a beautiful spiritual image for this Vedic verse: "${verse.sanskrit || verse.transliteration}". Style: peaceful, meditative, gold and earth tones.`;
      const imageBuffer = await this.aiProvider.generateImage(prompt, 'gemini');
      const filename = `verse-${verse.id}-${Date.now()}.webp`;
      const result = await this.storageService.uploadImage(imageBuffer, filename, 'public/verses-of-day', 'image/webp');
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

  // ── Sampraday-based FCM dispatch ──────────────────────────────────────────

  private async dispatchVerseOfDayNotifications(verse: any): Promise<void> {
    try {
      const title = '🙏 Verse of the Day';
      const body = verse.transliteration || verse.sanskrit || 'A new sacred verse awaits you.';

      // Get all published sampradayas and broadcast to their topic
      const sampradayas = await this.prisma.sampraday.findMany({
        where: { isPublished: true },
        select: { slug: true, nameKey: true },
      });

      await Promise.allSettled([
        // Per-sampraday topics (e.g. vod_gaudiya-vaishnava)
        ...sampradayas.map((s) =>
          this.notifications.broadcastVerseOfDayToSampraday(s.slug, title, body, verse.id),
        ),
        // Global fallback topic for users without a sampraday
        this.notifications.broadcastVerseOfDayGlobal(title, body, verse.id),
      ]);

      this.logger.log(`VoD notifications dispatched to ${sampradayas.length} sampraday topics + global`);
    } catch (error) {
      this.logger.error(`Failed to dispatch VoD notifications:`, error);
    }
  }

  private async getRandomVerse(): Promise<any> {
    try {
      const verseCount = await this.prisma.verse.count();
      if (!verseCount) throw new Error('No verses found in database');

      const verse = await this.prisma.verse.findFirst({ skip: Math.floor(Math.random() * verseCount) });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return await this.prisma.verseOfDay.create({
        data: { date: today, verseId: verse.id },
        include: { verse: true },
      });
    } catch (error) {
      this.logger.error(`Failed to get random verse:`, error);
      throw error;
    }
  }
}
