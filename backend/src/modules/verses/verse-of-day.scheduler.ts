import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VerseOfDayService } from './verse-of-day.service';
import { NotificationsService } from '@modules/notifications/notifications.service';

@Injectable()
export class VerseOfDayScheduler {
  private readonly logger = new Logger('VerseOfDayScheduler');

  constructor(
    private verseOfDayService: VerseOfDayService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 6 * * *', { name: 'daily-verse-of-day', timeZone: 'Asia/Kolkata' })
  async generateDailyVerse(): Promise<void> {
    this.logger.log('Running scheduled verse of day generation');
    try {
      const verseOfDay = await this.verseOfDayService.autoGenerateForToday();
      if (verseOfDay) {
        this.logger.log(`Verse of day ready: ${verseOfDay.verseId}`);
        await this.sendFCMNotification(verseOfDay);
      }
    } catch (error) {
      this.logger.error('Scheduled verse generation failed:', error);
    }
  }

  private async sendFCMNotification(verseOfDay: any): Promise<void> {
    try {
      await this.notificationsService.notifyVerseOfDayUpdate();
      this.logger.log('FCM push sent to verse-of-day topic');
    } catch (error) {
      this.logger.error('Failed to send FCM notification:', error);
    }
  }
}
