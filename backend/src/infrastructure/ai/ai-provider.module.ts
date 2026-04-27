import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIProviderFactory } from './ai-provider.factory';
import { AIProviderService } from './ai-provider.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ClaudeProvider,
    OpenAIProvider,
    GeminiProvider,
    AIProviderService,
    {
      provide: 'AI_PROVIDER',
      useFactory: (
        configService: ConfigService,
        claude: ClaudeProvider,
        openai: OpenAIProvider,
        gemini: GeminiProvider,
      ) => {
        return AIProviderFactory.create(
          configService.get<string>('AI_PROVIDER') || 'claude',
          { claude, openai, gemini },
        );
      },
      inject: [ConfigService, ClaudeProvider, OpenAIProvider, GeminiProvider],
    },
  ],
  exports: ['AI_PROVIDER', AIProviderService],
})
export class AIProviderModule {}
