import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@Controller('api/v1/chatbot')
export class ChatbotController {
  constructor(private chatbotService: ChatbotService) {}

  @Post('messages')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: any,
    @Body() dto: { message: string; conversationId?: string },
  ) {
    const result = await this.chatbotService.sendMessage({
      userId: user.id,
      message: dto.message,
      conversationId: dto.conversationId,
    });
    return result;
  }

  @Get('conversations/:id')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async getConversationHistory(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const messages = await this.chatbotService.getConversationHistory(conversationId);
    return { data: messages };
  }

  @Delete('conversations/:id')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async deleteConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const success = await this.chatbotService.deleteConversation(conversationId);
    return { success };
  }

  @Get('search')
  @Public()
  @HttpCode(HttpStatus.OK)
  async searchKnowledge(@Query('q') query: string) {
    const results = await this.chatbotService.searchKnowledge(query);
    return { data: results };
  }
}
