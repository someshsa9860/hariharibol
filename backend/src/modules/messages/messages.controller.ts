import { Controller, Get, Param, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('api/v1/groups')
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
}
