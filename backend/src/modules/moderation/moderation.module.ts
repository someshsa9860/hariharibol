import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AIProviderModule } from '@infrastructure/ai/ai-provider.module';
import { ModerationService } from './moderation.service';

@Module({
  imports: [PrismaModule, AIProviderModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
