import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('api/v1/groups')
@UseGuards(JwtGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get(':groupId/messages')
  getGroupMessages(
    @Param('groupId') groupId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.messagesService.getGroupMessages(
      groupId,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 50,
    );
  }

  @Post(':groupId/messages')
  sendMessage(
    @Param('groupId') groupId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.createMessage(groupId, userId, dto.content);
  }
}
