import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { GeminiProvider } from '@infrastructure/ai/providers/gemini.provider';
import { OpenAIProvider } from '@infrastructure/ai/providers/openai.provider';
import { AIMessage } from '@infrastructure/ai/ai-provider.interface';
import { CreateSessionDto } from './dto/create-session.dto';

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger('ChatbotService');

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private geminiProvider: GeminiProvider,
    private openAIProvider: OpenAIProvider,
  ) {}

  async createSession(userId: string, dto: CreateSessionDto) {
    const session = await this.prisma.chatbotSession.create({
      data: {
        userId,
        title: dto.title ?? null,
        guruPersonaUsed: 'GuruDev',
      },
    });

    this.logger.log(`Session created: ${session.id} for user ${userId}`);
    return session;
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.chatbotSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        messageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: sessions, total: sessions.length };
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            citations: {
              select: { verseId: true, excerpt: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.chatbotSession.delete({ where: { id: sessionId } });
    this.logger.log(`Session deleted: ${sessionId}`);
    return { success: true };
  }

  async sendMessage(sessionId: string, userId: string, message: string, res: Response) {
    await this.enforceRateLimit(userId);

    const session = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.chatbotMessage.create({
      data: { sessionId, role: 'user', content: message },
    });

    const relevantVerses = await this.fetchRelevantVerses(message, 3);
    const systemPrompt = this.buildGuruDevSystemPrompt(relevantVerses);

    const conversationHistory: AIMessage[] = [
      ...session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    let fullResponse = '';

    try {
      const stream = this.streamWithFallback(conversationHistory, systemPrompt);

      for await (const chunk of stream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    } catch (error) {
      this.logger.error('Streaming failed:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI provider unavailable' })}\n\n`);
      res.end();
      return;
    }

    const citedVerseIds = relevantVerses.map(v => v.id);

    const assistantMessage = await this.prisma.chatbotMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullResponse,
        citations: {
          create: citedVerseIds.map(verseId => ({ verseId })),
        },
      },
    });

    await this.prisma.chatbotSession.update({
      where: { id: sessionId },
      data: {
        messageCount: { increment: 2 },
        title: session.title ?? this.deriveTitle(message),
      },
    });

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMessage.id,
        citedVerseIds,
      })}\n\n`,
    );
    res.end();
  }

  private async *streamWithFallback(
    messages: AIMessage[],
    systemPrompt: string,
  ): AsyncGenerator<string> {
    try {
      const response = await this.geminiProvider.generateResponse(messages, systemPrompt, {
        stream: true,
        temperature: 0.7,
        maxTokens: 1024,
      });

      if ('stream' in response) {
        for await (const chunk of response.stream) {
          yield chunk;
        }
        return;
      }

      yield (response as any).content;
    } catch (geminiError) {
      this.logger.warn('Gemini streaming failed, falling back to OpenAI:', geminiError);

      const response = await this.openAIProvider.generateResponse(messages, systemPrompt, {
        stream: true,
        temperature: 0.7,
        maxTokens: 1024,
      });

      if ('stream' in response) {
        for await (const chunk of response.stream) {
          yield chunk;
        }
        return;
      }

      yield (response as any).content;
    }
  }

  private async fetchRelevantVerses(query: string, limit: number) {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) {
      return this.prisma.verse.findMany({
        take: limit,
        where: { isVerseOfDayEligible: true },
        include: { translations: { take: 1, where: { language: 'en' } } },
      });
    }

    return this.prisma.verse.findMany({
      where: {
        OR: [
          { categoryKeys: { hasSome: keywords } },
          { transliteration: { contains: keywords[0], mode: 'insensitive' } },
        ],
      },
      include: { translations: { take: 1, where: { language: 'en' } } },
      take: limit,
    });
  }

  private buildGuruDevSystemPrompt(verses: any[]): string {
    const verseContext =
      verses.length > 0
        ? `\n\nRelevant scripture context:\n${verses
            .map(v => {
              const translation = v.translations?.[0];
              const meaning = translation?.meaning?.substring(0, 150) ?? '';
              return `- ${v.verseId}${v.sanskrit ? `: "${v.sanskrit.substring(0, 80)}..."` : ''}${meaning ? ` — ${meaning}` : ''}`;
            })
            .join('\n')}`
        : '';

    return `You are GuruDev, a wise and compassionate spiritual guide on the HariHariBol platform.
You have profound knowledge of Sanatan Dharma, Vedic philosophy, Sanskrit scriptures, and the paths of
Bhakti, Karma, and Jnana Yoga. You are knowledgeable about the Bhagavad Gita, Srimad Bhagavatam,
Upanishads, Vedas, and other sacred texts.

Guidelines:
- Speak with wisdom, compassion, and humility
- Cite relevant verses by their verseId when appropriate
- Encourage sincere spiritual practice suited to the seeker's level
- Respect all sampradayas and spiritual traditions within Sanatan Dharma
- Keep responses meaningful, focused, and spiritually nourishing
- Avoid controversial political topics; focus on spiritual wisdom
- If a question is outside the domain of spirituality, gently redirect${verseContext}`;
  }

  private deriveTitle(message: string): string {
    return message.length > 60 ? message.substring(0, 57) + '...' : message;
  }

  private async enforceRateLimit(userId: string) {
    const key = `chatbot:rate:${userId}`;
    const windowData = await this.cacheService.get<{ count: number; windowExpiry: number }>(key);
    const now = Date.now();

    if (!windowData || windowData.windowExpiry <= now) {
      await this.cacheService.set(
        key,
        { count: 1, windowExpiry: now + RATE_LIMIT_WINDOW_MS },
        RATE_LIMIT_WINDOW_MS,
      );
      return;
    }

    if (windowData.count >= RATE_LIMIT_MAX) {
      const resetInMin = Math.ceil((windowData.windowExpiry - now) / 60000);
      throw new HttpException(
        `Rate limit exceeded: ${RATE_LIMIT_MAX} messages per hour. Resets in ${resetInMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const remainingTtl = windowData.windowExpiry - now;
    await this.cacheService.set(
      key,
      { count: windowData.count + 1, windowExpiry: windowData.windowExpiry },
      remainingTtl,
    );
  }
}
