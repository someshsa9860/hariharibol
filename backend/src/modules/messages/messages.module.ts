import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { ModerationModule } from '@modules/moderation/moderation.module';
import { BansModule } from '@modules/bans/bans.module';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [PrismaModule, ModerationModule, BansModule],
  controllers: [MessagesController],
  providers: [MessagesService, ChatGateway],
  exports: [MessagesService],
})
export class MessagesModule {}
