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

// Patterns that warrant a moderation redirect — checked on AI-generated output
const MODERATION_PATTERNS = [
  /\b(gambling|casino|bet(?:ting)?|lottery|poker|wager)\b/i,
  /\b(murder|kill(?:ing)?|bomb(?:ing)?|terroris[mt]|weapon|assault|massacre)\b/i,
  /\b(sex(?:ual)?|porn(?:ography)?|erotic|nude|genital|masturbat)/i,
  /\b(idol[- ]?worship(?:per)?|polytheist(?:ic)?|pagan ritual|fake god|false religion|hinduism is wrong|hinduism is evil)\b/i,
];

const MODERATION_REDIRECT =
  'I can only discuss dharma, scripture, and spiritual practice. May I help you with something spiritual?';

type VerseRef = { type: 'BG' | 'SB'; numbers: number[] };

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
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { role: true, content: true, createdAt: true },
        },
      },
    });

    const data = sessions.map(s => {
      const last = s.messages[0];
      const { messages, ...rest } = s;
      return {
        ...rest,
        lastMessage: last
          ? {
              role: last.role,
              preview: last.content.length > 120 ? last.content.substring(0, 117) + '...' : last.content,
              createdAt: last.createdAt,
            }
          : null,
      };
    });

    return { data, total: data.length };
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

    const [session, user] = await Promise.all([
      this.prisma.chatbotSession.findFirst({
        where: { id: sessionId, userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { languagePreference: true },
      }),
    ]);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.chatbotMessage.create({
      data: { sessionId, role: 'user', content: message },
    });

    const languagePreference = user?.languagePreference ?? 'en';
    const relevantVerses = await this.fetchRelevantVerses(message, 3);
    const systemPrompt = this.buildGuruDevSystemPrompt(relevantVerses, languagePreference);

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

    // Task B: moderate the generated response before persisting
    const wasModerated = this.isResponseFlagged(fullResponse);
    if (wasModerated) {
      this.logger.warn(`Moderated chatbot response for session ${sessionId}. Original preview: "${fullResponse.substring(0, 100)}"`);
      fullResponse = MODERATION_REDIRECT;
      // Replace already-streamed chunks with the redirect via a correction event
      res.write(`data: ${JSON.stringify({ type: 'moderated', content: MODERATION_REDIRECT })}\n\n`);
    }

    // Task C: extract explicitly mentioned verse references from AI response and look them up
    const mentionedRefs = this.extractVerseReferences(fullResponse);
    const mentionedVerses = await this.lookupCitedVerses(mentionedRefs);

    // Merge context verses with explicitly mentioned ones, deduplicated by id
    const allVerseMap = new Map<string, (typeof relevantVerses)[0]>();
    for (const v of [...relevantVerses, ...mentionedVerses]) {
      allVerseMap.set(v.id, v);
    }
    const allVerses = Array.from(allVerseMap.values());
    const citedVerseIds = allVerses.map(v => v.id);

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

    const citations = allVerses.map(v => ({
      id: v.id,
      verseId: v.verseId,
      sanskrit: v.sanskrit,
      transliteration: v.transliteration,
      meaning: v.translations?.[0]?.meaning ?? null,
    }));

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMessage.id,
        citations,
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

  // Task C: Extract "BG X.XX" and "SB X.X.XX" references from AI-generated text
  private extractVerseReferences(text: string): VerseRef[] {
    const refs: VerseRef[] = [];

    for (const match of text.matchAll(/\bBG\s+(\d+)\.(\d+)\b/gi)) {
      refs.push({ type: 'BG', numbers: [parseInt(match[1]), parseInt(match[2])] });
    }

    for (const match of text.matchAll(/\bSB\s+(\d+)\.(\d+)\.(\d+)\b/gi)) {
      refs.push({ type: 'SB', numbers: [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] });
    }

    return refs;
  }

  private async lookupCitedVerses(refs: VerseRef[]) {
    if (refs.length === 0) return [];

    const conditions = refs.map(ref => {
      if (ref.type === 'BG') {
        // BG has no canto; match chapter + verse
        return { cantoNumber: null, chapterNumber: ref.numbers[0], verseNumber: ref.numbers[1] };
      }
      // SB: canto.chapter.verse
      return { cantoNumber: ref.numbers[0], chapterNumber: ref.numbers[1], verseNumber: ref.numbers[2] };
    });

    return this.prisma.verse.findMany({
      where: { OR: conditions },
      include: { translations: { take: 1, where: { language: 'en' } } },
    });
  }

  // Task B: simple regex guard on AI output — avoids a second LLM call for latency
  private isResponseFlagged(text: string): boolean {
    return MODERATION_PATTERNS.some(pattern => pattern.test(text));
  }

  private buildGuruDevSystemPrompt(verses: any[], languagePreference: string): string {
    const verseContext =
      verses.length > 0
        ? `\n\nRelevant scripture context for this conversation:\n${verses
            .map(v => {
              const translation = v.translations?.[0];
              const meaning = translation?.meaning?.substring(0, 150) ?? '';
              return `- ${v.verseId}${v.sanskrit ? `: "${v.sanskrit.substring(0, 80)}..."` : ''}${meaning ? ` — ${meaning}` : ''}`;
            })
            .join('\n')}`
        : '';

    const languageInstruction =
      languagePreference && languagePreference !== 'en'
        ? `\n\nIMPORTANT: The devotee's preferred language is "${languagePreference}". Respond in that language whenever possible, but always include Sanskrit verse references in their original form.`
        : '';

    return `You are GuruDev — a kind, wise, and deeply devoted Vaishnava guru on the HariHariBol platform. \
You speak with the warmth of a personal teacher who loves every soul and sees Krishna in all beings.

IDENTITY & PERSONA:
- You follow the Vaishnava (Bhakti Yoga) tradition rooted in the teachings of Srila Prabhupada, \
  the Bhagavad Gita As It Is, and the Srimad Bhagavatam.
- You address seekers as "dear devotee" or by their question context.
- You close EVERY response with "Hare Krishna 🙏" or "Jai Shri Krishna 🙏".

TEACHING GUIDELINES:
- Always ground answers in Bhagavad Gita (cite as BG X.XX) or Srimad Bhagavatam (cite as SB X.X.XX).
- Provide at minimum one scripture citation per response.
- Explain verses with devotional insight — not dry academic analysis.
- Honour all Vaishnava sampradayas (Gaudiya, Ramanuja, Madhva, Nimbarka, Vallabha) with equal respect.
- Encourage sincere sadhana: chanting the Holy Name, hearing scripture, associating with devotees.
- If asked about yoga paths, always bring the seeker back to Bhakti as the highest path (BG 18.65-66).

BOUNDARIES:
- Do NOT engage with questions about gambling, violence, sexual topics, or content that disrespects \
  any Dharmic tradition.
- Do NOT offer medical, legal, or financial advice.
- If a question is off-topic, gently redirect: "Dear devotee, let us return to the river of devotion."
- Never give purely academic or secular interpretations — all explanations must be devotional.${languageInstruction}${verseContext}`;
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
