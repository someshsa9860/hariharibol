import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAIProvider } from './ai-provider.interface';

@Injectable()
export class AIProviderService {
  private readonly logger = new Logger('AIProviderService');

  constructor(
    @Inject('AI_PROVIDER') private aiProvider: IAIProvider,
    private configService: ConfigService,
  ) {}

  async generateText(
    prompt: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<string> {
    try {
      const response = await this.aiProvider.generateResponse(
        [{ role: 'user', content: prompt }],
        '',
        {
          temperature: options?.temperature || 0.7,
          maxTokens: options?.maxTokens || 500,
        },
      );

      // Handle both response types
      if ('content' in response) {
        return response.content;
      }

      // For streaming responses, collect all chunks
      let content = '';
      const stream = response.stream as AsyncIterable<string>;
      for await (const chunk of stream) {
        content += chunk;
      }

      return content;
    } catch (error) {
      this.logger.error(`Failed to generate text:`, error);
      throw error;
    }
  }

  async generateImage(prompt: string, provider: 'gemini' | 'openai' = 'gemini'): Promise<Buffer> {
    try {
      this.logger.log(`Generating image with ${provider}`);

      if (provider === 'gemini') {
        return await this.generateImageWithGemini(prompt);
      } else if (provider === 'openai') {
        return await this.generateImageWithOpenAI(prompt);
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      this.logger.error(`Failed to generate image:`, error);
      throw error;
    }
  }

  private async generateImageWithGemini(prompt: string): Promise<Buffer> {
    try {
      const apiKey = this.configService.get('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const enhancedPrompt = `Create a beautiful, spiritual image for: "${prompt}".
      Style: peaceful, meditative, gold and earth tones, intricate patterns, high quality, 4K.
      Aspect ratio: 1:1 (square).
      Avoid text in image.`;

      // Use Gemini API via HTTP (since we don't have vertex AI SDK configured)
      // This uses the REST endpoint for Gemini's vision capabilities
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: enhancedPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Gemini API error: ${error}`);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();

      // Extract image from response
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const imageUrl = this.extractImageUrl(result.candidates[0].content.parts[0].text);
        if (imageUrl) {
          return await this.downloadImage(imageUrl);
        }
      }

      // Fallback: Return a placeholder if image generation not available
      return this.getPlaceholderImage();
    } catch (error) {
      this.logger.error(`Gemini image generation failed:`, error);
      return this.getPlaceholderImage();
    }
  }

  private async generateImageWithOpenAI(prompt: string): Promise<Buffer> {
    try {
      const apiKey = this.configService.get('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const enhancedPrompt = `Create a beautiful, spiritual image for: "${prompt}".
      Style: peaceful, meditative, gold and earth tones, intricate patterns, high quality, 4K.
      Aspect ratio: 1:1 (square).`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'hd',
          model: 'dall-e-3',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`OpenAI API error: ${error}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.[0]?.url) {
        return await this.downloadImage(result.data[0].url);
      }

      return this.getPlaceholderImage();
    } catch (error) {
      this.logger.error(`OpenAI image generation failed:`, error);
      return this.getPlaceholderImage();
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`Failed to download image:`, error);
      return this.getPlaceholderImage();
    }
  }

  private extractImageUrl(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/[^\s\)]+\.(jpg|jpeg|png|webp|gif)/i);
    return urlMatch ? urlMatch[0] : null;
  }

  private getPlaceholderImage(): Buffer {
    // Return a simple 512x512 white PNG
    return Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x28,
      0xdc, 0x00, 0x00, 0x00, 0x19, 0x74, 0x45, 0x58, 0x74, 0x53, 0x6f, 0x66, 0x74, 0x77, 0x61, 0x72,
      0x65, 0x00, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x20, 0x49, 0x6d, 0x61, 0x67, 0x65, 0x52, 0x65, 0x61,
      0x64, 0x79, 0x71, 0xc9, 0x65, 0x3c, 0x00, 0x00, 0x08, 0x00, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda,
      0xec, 0xdd, 0x01, 0x01, 0x00, 0x00, 0x00, 0xc2, 0xa0, 0xf5, 0x4f, 0xed, 0x61, 0x0d, 0xa0, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xd8, 0x3c, 0xd4, 0xae, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  }

  async moderateContent(
    content: string,
    context?: string,
  ): Promise<{
    verdict: 'safe' | 'disrespectful' | 'spam' | 'off_topic';
    confidence: number;
    reason?: string;
  }> {
    try {
      return await this.aiProvider.moderateMessage(content, context);
    } catch (error) {
      this.logger.error(`Failed to moderate content:`, error);
      return {
        verdict: 'safe',
        confidence: 0,
        reason: 'Moderation unavailable',
      };
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      return await this.aiProvider.getTokenCount(text);
    } catch (error) {
      this.logger.error(`Failed to count tokens:`, error);
      // Rough estimate: 1 token ≈ 4 characters
      return Math.ceil(text.length / 4);
    }
  }
}
