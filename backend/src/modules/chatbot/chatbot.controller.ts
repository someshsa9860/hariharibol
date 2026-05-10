import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatbotService } from './chatbot.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('api/v1/chatbot')
@UseGuards(JwtGuard)
export class ChatbotController {
  constructor(private chatbotService: ChatbotService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@CurrentUser() user: any, @Body() dto: CreateSessionDto) {
    return this.chatbotService.createSession(user.id, dto);
  }

  @Get('sessions')
  async getSessions(@CurrentUser() user: any) {
    return this.chatbotService.getSessions(user.id);
  }

  @Get('sessions/:id')
  async getSession(@CurrentUser() user: any, @Param('id') sessionId: string) {
    return this.chatbotService.getSession(sessionId, user.id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@CurrentUser() user: any, @Param('id') sessionId: string) {
    return this.chatbotService.deleteSession(sessionId, user.id);
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @CurrentUser() user: any,
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      await this.chatbotService.sendMessage(sessionId, user.id, dto.message, res);
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: error.message ?? 'Internal error' })}\n\n`,
      );
      res.end();
    }
  }
}
