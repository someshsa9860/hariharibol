import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IAIProvider, AIMessage, AIResponse, AIStreamResponse } from '../ai-provider.interface';

@Injectable()
export class OpenAIProvider implements IAIProvider {
  private readonly logger = new Logger('OpenAIProvider');
  private client: OpenAI;
  private model = 'gpt-4o';

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateResponse(
    messages: AIMessage[],
    systemPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    },
  ): Promise<AIResponse | AIStreamResponse> {
    try {
      if (options?.stream) {
        return this.generateStreamResponse(messages, systemPrompt, options);
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        ],
      });

      const content = response.choices[0].message.content || '';

      return {
        content,
        tokens_used: response.usage?.total_tokens || 0,
      };
    } catch (error) {
      this.logger.error('Error generating response from OpenAI', error);
      throw error;
    }
  }

  private async generateStreamResponse(
    messages: AIMessage[],
    systemPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AIStreamResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature || 0.7,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      ],
    });

    async function* streamGenerator() {
      for await (const chunk of stream) {
        if (chunk.choices[0].delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    }

    return {
      stream: streamGenerator(),
      onComplete: (async () => ({
        content: 'See stream for content',
        tokens_used: 0, // OpenAI streaming doesn't provide token count upfront
      }))(),
    };
  }

  async moderateMessage(
    content: string,
    context?: string,
  ): Promise<{
    verdict: 'safe' | 'disrespectful' | 'spam' | 'off_topic';
    confidence: number;
    reason?: string;
  }> {
    const systemPrompt = `You are a moderation system for a spiritual Sanatan Dharma community.
    Evaluate messages for: safe/respectful, disrespectful (of spiritual traditions), spam, or off-topic.
    Respond in JSON format: { "verdict": "...", "confidence": 0.0-1.0, "reason": "..." }`;

    const prompt = `Moderate this message in a Sanatan Dharma community context:
    ${context ? `Context: ${context}\n` : ''}
    Message: "${content}"`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    try {
      const text = response.choices[0].message.content || '{}';
      const result = JSON.parse(text);
      return result;
    } catch {
      return {
        verdict: 'off_topic',
        confidence: 0.5,
        reason: 'Unable to parse moderation response',
      };
    }
  }

  async getTokenCount(text: string): Promise<number> {
    // OpenAI doesn't have a free token counting API; estimate or use completions
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: text }],
      max_tokens: 1,
    });
    return response.usage?.prompt_tokens || Math.ceil(text.length / 4);
  }
}
