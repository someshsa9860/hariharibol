export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  tokens_used: number;
  citations?: Array<{
    verse_id: string;
    excerpt: string;
  }>;
}

export interface AIStreamResponse {
  stream: AsyncIterable<string>;
  onComplete: Promise<AIResponse>;
}

export interface IAIProvider {
  generateResponse(
    messages: AIMessage[],
    systemPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    },
  ): Promise<AIResponse | AIStreamResponse>;

  moderateMessage(
    content: string,
    context?: string,
  ): Promise<{
    verdict: 'safe' | 'disrespectful' | 'spam' | 'off_topic';
    confidence: number;
    reason?: string;
  }>;

  getTokenCount(text: string): Promise<number>;
}
