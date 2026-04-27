import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
