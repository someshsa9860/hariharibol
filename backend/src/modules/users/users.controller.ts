import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { UsersService } from './services/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { PrismaService } from '@infrastructure/database/prisma.service';

class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  sampradayId: string;
}

class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  verseOfDay?: boolean;

  @IsBoolean()
  @IsOptional()
  announcements?: boolean;
}

@Controller('api/v1/users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: any): Promise<UserResponseDto> {
    return this.usersService.getUser(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(user.id, dto);
  }

  @Post('me/onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentUser() user: any,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<UserResponseDto> {
    return this.usersService.completeOnboarding(user.id, dto.sampradayId);
  }

  @Get('me/notification-preferences')
  @HttpCode(HttpStatus.OK)
  async getNotificationPreferences(@CurrentUser() user: any) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { notifVerseOfDay: true, notifAnnouncements: true },
    });
    return { data: record };
  }

  @Patch('me/notification-preferences')
  @HttpCode(HttpStatus.OK)
  async updateNotificationPreferences(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.verseOfDay !== undefined && { notifVerseOfDay: dto.verseOfDay }),
        ...(dto.announcements !== undefined && { notifAnnouncements: dto.announcements }),
      },
      select: { notifVerseOfDay: true, notifAnnouncements: true },
    });

    // Sync device FCM topic subscriptions with new preferences
    const devices = await this.prisma.device.findMany({
      where: { userIds: { has: user.id }, isBanned: false },
      select: { deviceId: true, fcmToken: true },
    });

    const tokens = devices.filter((d) => d.fcmToken).map((d) => ({ token: d.fcmToken!, deviceId: d.deviceId }));

    await Promise.allSettled(
      tokens.flatMap(({ token, deviceId }) => {
        const ops: Promise<boolean>[] = [];
        if (dto.verseOfDay !== undefined) {
          ops.push(
            dto.verseOfDay
              ? this.notificationsService.subscribeToTopic(token, 'verse-of-day', deviceId)
              : this.notificationsService.unsubscribeFromTopic(token, 'verse-of-day'),
          );
        }
        if (dto.announcements !== undefined) {
          ops.push(
            dto.announcements
              ? this.notificationsService.subscribeToTopic(token, 'announcements', deviceId)
              : this.notificationsService.unsubscribeFromTopic(token, 'announcements'),
          );
        }
        return ops;
      }),
    );

    return { data: updated };
  }
}
