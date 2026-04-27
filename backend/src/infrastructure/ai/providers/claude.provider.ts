import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from 'anthropic';
import { IAIProvider, AIMessage, AIResponse, AIStreamResponse } from '../ai-provider.interface';

@Injectable()
export class ClaudeProvider implements IAIProvider {
  private readonly logger = new Logger('ClaudeProvider');
  private client: Anthropic;
  private model = 'claude-3-5-sonnet-20241022';

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
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

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens || 2048,
        system: systemPrompt,
        temperature: options?.temperature || 0.7,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      return {
        content,
        tokens_used: response.usage.output_tokens + response.usage.input_tokens,
      };
    } catch (error) {
      this.logger.error('Error generating response from Claude', error);
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
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: options?.maxTokens || 2048,
      system: systemPrompt,
      temperature: options?.temperature || 0.7,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    async function* streamGenerator() {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          yield chunk.delta.text;
        }
      }
    }

    return {
      stream: streamGenerator(),
      onComplete: stream.finalMessage().then(msg => ({
        content:
          msg.content[0].type === 'text' ? msg.content[0].text : '',
        tokens_used: msg.usage.output_tokens + msg.usage.input_tokens,
      })),
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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
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
    const response = await this.client.messages.countTokens({
      model: this.model,
      messages: [{ role: 'user', content: text }],
    });
    return response.input_tokens;
  }
}
