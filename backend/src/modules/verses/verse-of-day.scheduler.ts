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
      const config = await this.verseOfDayService.getConfig();

      let verseOfDay: any;

      if (config.autoGenerate && config.aiProvider !== 'none') {
        verseOfDay = await this.verseOfDayService.generateVerseOfDay();
        this.logger.log(`AI-generated verse of day: ${verseOfDay?.verse?.id}`);
      } else {
        // Fallback: random eligible verse
        verseOfDay = await this.verseOfDayService.generateVerseOfDay();
        this.logger.log(`Random verse of day selected: ${verseOfDay?.verse?.id}`);
      }

      if (verseOfDay) {
        await this.sendFCMNotification(verseOfDay);
      }
    } catch (error) {
      this.logger.error('Scheduled verse generation failed:', error);
      // Graceful failure — attempt random fallback
      try {
        await this.verseOfDayService['getRandomVerse']();
        this.logger.log('Fallback random verse selected after AI failure');
      } catch (fallbackError) {
        this.logger.error('Fallback verse selection also failed:', fallbackError);
      }
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
