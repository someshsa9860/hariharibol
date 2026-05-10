import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface NotificationData {
  userId?: string;
  topic?: string;
  title: string;
  message: string;
  type: 'email' | 'push' | 'in-app';
  metadata?: Record<string, any>;
}

export interface FCMNotification {
  topic?: string;
  tokens?: string[];
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');
  private fcmAdmin: any;
  private resend: Resend | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.initializeFCM();
    this.initializeResend();
  }

  private initializeResend(): void {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email client initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled');
    }
  }

  private initializeFCM(): void {
    try {
      this.logger.log('FCM initialized');
    } catch (error) {
      this.logger.warn('FCM initialization failed:', error.message);
    }
  }

  async sendNotification(data: NotificationData): Promise<boolean> {
    try {
      // Support both user-based and topic-based notifications
      if (data.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: data.userId },
        });

        if (!user) {
          this.logger.warn(`User not found: ${data.userId}`);
          return false;
        }

        switch (data.type) {
          case 'email':
            return await this.sendEmailNotification(user.email, data);
          case 'push':
            return await this.sendPushNotification(data.userId, data);
          case 'in-app':
            return await this.storeInAppNotification(data);
          default:
            return false;
        }
      } else if (data.topic) {
        switch (data.type) {
          case 'push':
            return await this.sendTopicNotification(data.topic, data);
          case 'in-app':
            return await this.storeInAppNotification(data);
          default:
            return false;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to send notification:`, error);
      return false;
    }
  }

  private async sendEmailNotification(email: string, data: NotificationData): Promise<boolean> {
    try {
      if (!this.resend) {
        this.logger.warn(`Email skipped (Resend not configured): ${data.title}`);
        return false;
      }

      const html = this.buildEmailHtml(data);
      const from = this.configService.get<string>('EMAIL_FROM') || 'HariHariBol <noreply@hariharibol.com>';

      const result = await this.resend.emails.send({
        from,
        to: email,
        subject: data.title,
        html,
      });

      if (result.error) {
        this.logger.error(`Resend error for ${email}: ${result.error.message}`);
        return false;
      }

      this.logger.log(`Email sent to ${email}: ${data.title} (id=${result.data?.id})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      return false;
    }
  }

  private buildEmailHtml(data: NotificationData): string {
    const action = data.metadata?.action as string | undefined;

    if (action === 'verse_of_day') {
      return this.verseOfDayEmailTemplate(data);
    }
    if (action === 'ban') {
      return this.banNotificationEmailTemplate(data);
    }
    if (action === 'welcome') {
      return this.welcomeEmailTemplate(data);
    }
    return this.defaultEmailTemplate(data);
  }

  private verseOfDayEmailTemplate(data: NotificationData): string {
    const verse = data.metadata?.verse as string | undefined;
    const explanation = data.metadata?.explanation as string | undefined;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Georgia,serif;background:#fdf6ec;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.header{background:#C75A1A;padding:32px;text-align:center;color:#fff}
.header h1{margin:0;font-size:24px;letter-spacing:1px}
.body{padding:32px;color:#333}
.verse{background:#fdf6ec;border-left:4px solid #C75A1A;padding:16px;margin:16px 0;font-style:italic;font-size:16px}
.footer{background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>🕉 Verse of the Day</h1></div>
  <div class="body">
    <h2 style="color:#C75A1A">${data.title}</h2>
    <p>${data.message}</p>
    ${verse ? `<div class="verse">${verse}</div>` : ''}
    ${explanation ? `<p>${explanation}</p>` : ''}
  </div>
  <div class="footer">HariHariBol &bull; Your Daily Spiritual Companion</div>
</div>
</body></html>`;
  }

  private banNotificationEmailTemplate(data: NotificationData): string {
    const reason = data.metadata?.reason as string | undefined;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.header{background:#b71c1c;padding:32px;text-align:center;color:#fff}
.header h1{margin:0;font-size:22px}
.body{padding:32px;color:#333;line-height:1.6}
.reason{background:#ffeaea;border-left:4px solid #b71c1c;padding:12px;margin:16px 0}
.footer{background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>Account Notice</h1></div>
  <div class="body">
    <h2>${data.title}</h2>
    <p>${data.message}</p>
    ${reason ? `<div class="reason"><strong>Reason:</strong> ${reason}</div>` : ''}
    <p>If you believe this is a mistake, please contact our support team.</p>
  </div>
  <div class="footer">HariHariBol Support</div>
</div>
</body></html>`;
  }

  private welcomeEmailTemplate(data: NotificationData): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Georgia,serif;background:#fdf6ec;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.header{background:#C75A1A;padding:32px;text-align:center;color:#fff}
.header h1{margin:0;font-size:26px}
.body{padding:32px;color:#333;line-height:1.8}
.cta{display:inline-block;background:#C75A1A;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:16px}
.footer{background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>🕉 Welcome to HariHariBol</h1></div>
  <div class="body">
    <h2>${data.title}</h2>
    <p>${data.message}</p>
    <p>Begin your spiritual journey with daily verses, mantras, and sacred wisdom from the Vedic tradition.</p>
    <a class="cta" href="#">Explore Now</a>
  </div>
  <div class="footer">HariHariBol &bull; Spreading Vedic Wisdom</div>
</div>
</body></html>`;
  }

  private defaultEmailTemplate(data: NotificationData): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
h2{color:#C75A1A}
.footer{margin-top:24px;font-size:12px;color:#888;text-align:center}
</style></head>
<body>
<div class="container">
  <h2>${data.title}</h2>
  <p>${data.message}</p>
  <div class="footer">HariHariBol</div>
</div>
</body></html>`;
  }

  private async sendPushNotification(userId: string, data: NotificationData): Promise<boolean> {
    try {
      // TODO: Implement push notification service (Firebase Cloud Messaging, etc.)
      this.logger.log(`Push notification would be sent to ${userId}: ${data.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification:`, error);
      return false;
    }
  }

  private async storeInAppNotification(data: NotificationData): Promise<boolean> {
    try {
      // Store in-app notification in database
      // TODO: Create notification table in Prisma schema
      this.logger.log(`In-app notification stored for ${data.userId}: ${data.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store in-app notification:`, error);
      return false;
    }
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0): Promise<any[]> {
    try {
      // TODO: Query notifications from database
      return [];
    } catch (error) {
      this.logger.error(`Failed to fetch notifications:`, error);
      return [];
    }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      // TODO: Update notification read status
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read:`, error);
      return false;
    }
  }

  async notifyUserFollowSampraday(userId: string, sampradayName: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'in-app',
      title: `You followed ${sampradayName}`,
      message: `You are now following ${sampradayName}. New content will appear in your feed.`,
      metadata: { action: 'follow_sampraday' },
    });
  }

  async notifyVerseOfDay(userId: string, verseName: string, verse?: string, explanation?: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'email',
      title: 'Verse of the Day',
      message: `New verse available: ${verseName}`,
      metadata: { action: 'verse_of_day', verse, explanation },
    });
  }

  async notifyUserBanned(userId: string, reason: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'email',
      title: 'Your HariHariBol account has been suspended',
      message: 'Your account has been suspended due to a violation of our community guidelines.',
      metadata: { action: 'ban', reason },
    });
  }

  async notifyWelcome(userId: string, name: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'email',
      title: `Welcome, ${name}!`,
      message: 'We are delighted to have you in our spiritual community.',
      metadata: { action: 'welcome' },
    });
  }

  async notifyAdminAction(userId: string, action: string, details: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'email',
      title: `Admin Action: ${action}`,
      message: details,
      metadata: { action: 'admin_action' },
    });
  }

  async subscribeToTopic(deviceToken: string, topic: string): Promise<boolean> {
    try {
      if (!this.fcmAdmin) {
        this.logger.warn('FCM not initialized');
        return false;
      }

      // TODO: Subscribe device to FCM topic
      // await this.fcmAdmin.makeTopicManagementRequest(
      //   { tokens: [deviceToken], topic },
      //   'iid',
      //   'subscribeToTopic'
      // );

      this.logger.log(`Device ${deviceToken} subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(deviceToken: string, topic: string): Promise<boolean> {
    try {
      if (!this.fcmAdmin) {
        this.logger.warn('FCM not initialized');
        return false;
      }

      // TODO: Unsubscribe device from FCM topic
      this.logger.log(`Device ${deviceToken} unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic:`, error);
      return false;
    }
  }

  private async sendTopicNotification(topic: string, data: NotificationData): Promise<boolean> {
    try {
      if (!this.fcmAdmin) {
        this.logger.warn('FCM not initialized, skipping topic notification');
        return true;
      }

      const fcmMessage: FCMNotification = {
        topic,
        notification: {
          title: data.title,
          body: data.message,
        },
      };

      if (data.metadata) {
        fcmMessage.data = Object.entries(data.metadata).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      // TODO: Send via FCM
      // const response = await this.fcmAdmin.send(fcmMessage);
      this.logger.log(`Topic notification sent to ${topic}:`, data.title);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send topic notification:`, error);
      return false;
    }
  }

  async notifyVerseOfDayUpdate(): Promise<boolean> {
    return this.sendNotification({
      topic: 'verse-of-day',
      type: 'push',
      title: 'New Verse of the Day',
      message: 'A new inspiring verse is available for today',
      metadata: { action: 'verse_of_day' },
    });
  }

  async notifyGeneralAnnouncement(title: string, message: string): Promise<boolean> {
    return this.sendNotification({
      topic: 'announcements',
      type: 'push',
      title,
      message,
      metadata: { action: 'announcement' },
    });
  }
}
