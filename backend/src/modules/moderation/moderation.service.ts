import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '@infrastructure/ai/ai-provider.service';
import { PrismaService } from '@infrastructure/database/prisma.service';

export type ModerationVerdict = 'SAFE' | 'DISRESPECTFUL' | 'SPAM';

export interface ModerationResult {
  verdict: ModerationVerdict;
  confidence: number;
  reason: string;
  safe: boolean;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private prisma: PrismaService,
    private aiProvider: AIProviderService,
  ) {}

  async moderateContent(content: string): Promise<ModerationResult> {
    try {
      const prompt = `Analyze the following message from a spiritual community chat and classify it.

Message: "${content.replace(/"/g, "'")}"

Classify as exactly one of:
- SAFE: respectful, appropriate spiritual discussion or general conversation
- DISRESPECTFUL: insulting, offensive, blasphemous, or disrespectful content
- SPAM: repetitive, promotional, meaningless, or irrelevant content

Respond with JSON only (no markdown):
{"verdict":"SAFE","confidence":0.95,"reason":"brief reason"}`;

      const response = await this.aiProvider.generateText(prompt, 'You are a content moderation AI. Respond only with valid JSON.', {
        temperature: 0.1,
        maxTokens: 150,
      });

      const jsonMatch = response.match(/\{[^}]+\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');

      const parsed = JSON.parse(jsonMatch[0]);
      const allowed: ModerationVerdict[] = ['SAFE', 'DISRESPECTFUL', 'SPAM'];
      const verdict: ModerationVerdict = allowed.includes(parsed.verdict) ? parsed.verdict : 'SAFE';

      return {
        verdict,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        safe: verdict === 'SAFE',
      };
    } catch (error) {
      this.logger.error('AI moderation failed, defaulting to SAFE', error);
      return { verdict: 'SAFE', confidence: 0, reason: 'moderation_unavailable', safe: true };
    }
  }

  async getUserViolationCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        userId,
        status: 'hidden',
        aiVerdict: { not: null },
      },
    });
  }
}
