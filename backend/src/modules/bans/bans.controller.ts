import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  Get,
  Query,
} from '@nestjs/common';
import { BansService } from './bans.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/bans')
export class BansController {
  constructor(private bansService: BansService) {}

  @Get()
  getActiveBans(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.bansService.getActiveBans(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('history')
  getBanHistory(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.bansService.getBanHistory(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Post('users/:userId')
  banUser(
    @Param('userId') userId: string,
    @Body() body: { reason: string },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.bansService.banUser(userId, body.reason, 'admin', { adminId });
  }

  @Delete(':banId')
  unbanUser(
    @Param('banId') banId: string,
    @Body() body: { reason: string },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.bansService.unbanUser(banId, body.reason, adminId);
  }
}
