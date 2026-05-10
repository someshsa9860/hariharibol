import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  getGroups(
    @Query('sampradayId') sampradayId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.groupsService.getGroups(
      sampradayId,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get(':id')
  getGroup(@Param('id') id: string) {
    return this.groupsService.getGroup(id);
  }

  @Post(':id/join')
  joinGroup(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.groupsService.joinGroup(id, userId);
  }

  @Post(':id/leave')
  leaveGroup(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.groupsService.leaveGroup(id, userId);
  }

  @Get(':id/members')
  getGroupMembers(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.groupsService.getGroupMembers(
      id,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 50,
    );
  }
}
