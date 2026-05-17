import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AIProviderService } from '@infrastructure/ai/ai-provider.service';
import { StorageService } from '@infrastructure/storage/storage.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppSettingsService } from './app-settings.service';

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
    private appSettings: AppSettingsService,
  ) {}

  // ── Config via AppSettings table ─────────────────────────────────────────

  async getConfig(): Promise<VerseOfDayConfig> {
    try {
      return {
        aiProvider: (await this.appSettings.get(SETTINGS_KEYS.AI_PROVIDER, 'gemini')) as 'gemini' | 'openai' | 'none',
        autoGenerate: (await this.appSettings.get(SETTINGS_KEYS.AUTO_GENERATE, 'false')) === 'true',
        generateImage: (await this.appSettings.get(SETTINGS_KEYS.GENERATE_IMAGE, 'false')) === 'true',
      };
    } catch (error) {
      this.logger.error(`Failed to get config:`, error);
      return { aiProvider: 'none', autoGenerate: false, generateImage: false };
    }
  }

  async updateConfig(config: Partial<VerseOfDayConfig>): Promise<VerseOfDayConfig> {
    try {
      const ops: Promise<void>[] = [];
      if (config.aiProvider !== undefined)
        ops.push(this.appSettings.set(SETTINGS_KEYS.AI_PROVIDER, config.aiProvider));
      if (config.autoGenerate !== undefined)
        ops.push(this.appSettings.set(SETTINGS_KEYS.AUTO_GENERATE, String(config.autoGenerate)));
      if (config.generateImage !== undefined)
        ops.push(this.appSettings.set(SETTINGS_KEYS.GENERATE_IMAGE, String(config.generateImage)));

      await Promise.all(ops);
      this.logger.log('VoD config updated');
      return this.getConfig();
    } catch (error) {
      this.logger.error(`Failed to update config:`, error);
      throw error;
    }
  }

  // ── Scheduler entry point ─────────────────────────────────────────────────

  async autoGenerateForToday(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.verseOfDay.findFirst({
      where: { date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
    });

    if (existing) {
      this.logger.log('Verse of day already set for today, skipping generation');
      return existing;
    }

    const config = await this.getConfig();
    if (config.autoGenerate && config.aiProvider !== 'none') {
      return this.generateVerseOfDay();
    }
    return this.getRandomVerse();
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

      let candidates = await this.prisma.verse.findMany({
        where: { isVerseOfDayEligible: true },
        select: { id: true, verseId: true, sanskrit: true, transliteration: true, categoryKeys: true },
        take: 50,
      });

      if (!candidates.length) {
        candidates = await this.prisma.verse.findMany({
          select: { id: true, verseId: true, sanskrit: true, transliteration: true, categoryKeys: true },
          take: 50,
        });
      }

      if (!candidates.length) throw new Error('No verses found in database');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0];

      const verseList = candidates
        .map((v) => `${v.verseId}: ${(v.transliteration ?? v.sanskrit ?? '').substring(0, 60)}`)
        .join('\n');

      const selectionPrompt =
        `Today is ${dateStr}. Select the single most spiritually meaningful verse for today from this list. ` +
        `Return ONLY the verse ID (e.g. "1.2.47"), nothing else.\nVerses:\n${verseList}`;

      const aiSelectedId = await this.aiProvider.generateText(selectionPrompt, config.aiProvider, { maxTokens: 50 });

      let selectedVerse = candidates.find((v) => v.verseId === aiSelectedId.trim());

      if (!selectedVerse) {
        this.logger.warn(`AI returned unrecognised verseId "${aiSelectedId.trim()}", falling back to random`);
        selectedVerse = candidates[Math.floor(Math.random() * candidates.length)];
      }

      const explanationPrompt = `Give a 2-3 sentence spiritual insight about this verse: ${selectedVerse.transliteration ?? selectedVerse.sanskrit}`;
      const explanation = await this.aiProvider.generateText(explanationPrompt, config.aiProvider, { maxTokens: 150 });

      const fullVerse = await this.prisma.verse.findUnique({ where: { id: selectedVerse.id } });

      let imageUrl: string | null = null;
      if (config.generateImage) {
        imageUrl = await this.generateVerseImage(fullVerse);
      }

      const verseOfDay = await this.prisma.verseOfDay.create({
        data: { date: today, verseId: selectedVerse.id, imageUrl, aiGenerated: true, explanation },
        include: { verse: true },
      });

      await this.dispatchVerseOfDayNotifications(fullVerse);
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
      const config = await this.getConfig();
      const imageProvider = config.aiProvider === 'none' ? 'gemini' : config.aiProvider;
      const verseText = verse.transliteration || verse.sanskrit || '';
      const prompt =
        `A serene, spiritual artwork inspired by the Hindu verse: "${verseText}". ` +
        `Style: traditional Indian miniature painting with golden accents, lotus flowers, divine light. ` +
        `Colors: saffron, gold, deep blue. No text in image.`;

      const imageBuffer = await this.aiProvider.generateImage(prompt, imageProvider);

      const dateStr = new Date().toISOString().split('T')[0];
      const folder = `public/verses-of-day/${dateStr}`;
      const result = await this.storageService.uploadImage(imageBuffer, 'image.webp', folder, 'image/webp');

      this.logger.log(`Verse image generated and uploaded: ${result.url}`);
      return result.url;
    } catch (error) {
      this.logger.error(`Failed to generate verse image for verse ${verse?.id}:`, error);
      return null;
    }
  }

  async regenerateImageForToday(): Promise<{ imageUrl: string | null }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const verseOfDay = await this.prisma.verseOfDay.findFirst({
        where: { date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
        include: { verse: true },
      });

      if (!verseOfDay) {
        throw new BadRequestException('No verse of day found for today');
      }

      const imageUrl = await this.generateVerseImage(verseOfDay.verse);

      if (imageUrl) {
        await this.prisma.verseOfDay.update({
          where: { id: verseOfDay.id },
          data: { imageUrl },
        });
        this.logger.log(`Regenerated image for today's verse of day: ${imageUrl}`);
      } else {
        this.logger.warn(`Image regeneration returned null for today's verse of day`);
      }

      return { imageUrl };
    } catch (error) {
      this.logger.error(`Failed to regenerate image for today's verse of day:`, error);
      throw error;
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
