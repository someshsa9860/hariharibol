import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAIProvider, AIMessage, AIResponse, AIStreamResponse } from '../ai-provider.interface';

@Injectable()
export class GeminiProvider implements IAIProvider {
  private readonly logger = new Logger('GeminiProvider');
  private apiKey: string;
  private model = 'gemini-1.5-pro';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
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

      const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

      const requestBody = {
        contents: this.buildContents(messages, systemPrompt),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      const content =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        tokens_used: data.usageMetadata?.totalTokenCount || 0,
      };
    } catch (error) {
      this.logger.error('Error generating response from Gemini', error);
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
    const url = `${this.baseUrl}/${this.model}:streamGenerateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: this.buildContents(messages, systemPrompt),
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 2048,
      },
    };

    async function* streamGenerator() {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) yield text;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    return {
      stream: streamGenerator(),
      onComplete: Promise.resolve({
        content: 'See stream for content',
        tokens_used: 0,
      }),
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

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'OK' }] },
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        maxOutputTokens: 200,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
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
    const url = `${this.baseUrl}/${this.model}:countTokens?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
      }),
    });

    const data = await response.json();
    return data.totalTokens || Math.ceil(text.length / 4);
  }

  private buildContents(messages: AIMessage[], systemPrompt: string) {
    return [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ];
  }
}
