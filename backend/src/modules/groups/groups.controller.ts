import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('api/v1/groups')
@UseGuards(JwtGuard)
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

  @Post()
  createGroup(@Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(dto.sampradayId, dto.nameKey, dto.descriptionKey);
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
