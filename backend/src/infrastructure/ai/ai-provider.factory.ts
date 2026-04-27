import { IAIProvider } from './ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';

export class AIProviderFactory {
  static create(
    providerName: string,
    providers: {
      claude: ClaudeProvider;
      openai: OpenAIProvider;
      gemini: GeminiProvider;
    },
  ): IAIProvider {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return providers.openai;
      case 'gemini':
        return providers.gemini;
      case 'claude':
      default:
        return providers.claude;
    }
  }
}
