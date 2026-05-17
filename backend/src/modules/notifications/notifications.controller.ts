import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

class SubscribeTopicDto {
  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

@Controller('api/v1/notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('')
  @HttpCode(HttpStatus.OK)
  async getNotifications(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const notifications = await this.notificationsService.getUserNotifications(
      user.id,
      limit || 20,
      offset || 0,
    );
    return { data: notifications };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser() user: any,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationsService.markAsRead(notificationId);
    return { success };
  }

  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  async sendTestNotification(
    @CurrentUser() user: any,
    @Body() dto: { type: 'email' | 'push' | 'in-app'; title: string; message: string },
  ) {
    const success = await this.notificationsService.sendNotification({
      userId: user.id,
      type: dto.type,
      title: dto.title,
      message: dto.message,
    });
    return { success };
  }

  @Get('topics')
  @HttpCode(HttpStatus.OK)
  async getTopics() {
    const topics = await this.notificationsService.getAvailableTopics();
    return { data: topics };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Body() dto: SubscribeTopicDto) {
    const success = await this.notificationsService.subscribeToTopic(
      dto.deviceToken,
      dto.topic,
      dto.deviceId ?? '',
    );
    return { success };
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: SubscribeTopicDto) {
    const success = await this.notificationsService.unsubscribeFromTopic(
      dto.deviceToken,
      dto.topic,
    );
    return { success };
  }
}
