import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AIProviderModule } from '@infrastructure/ai/ai-provider.module';
import { CacheService } from '@infrastructure/cache/cache.service';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';

@Module({
  imports: [PrismaModule, ConfigModule, AIProviderModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, CacheService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
