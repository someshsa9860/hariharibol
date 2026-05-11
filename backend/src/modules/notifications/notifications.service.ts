import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as admin from 'firebase-admin';

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
  notification: { title: string; body: string };
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');
  private fcmInitialized = false;
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
      if (admin.apps.length > 0) {
        this.fcmInitialized = true;
        return;
      }

      const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        this.fcmInitialized = true;
        this.logger.log('Firebase Admin (FCM) initialized');
      } else if (projectId) {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
        this.fcmInitialized = true;
        this.logger.log('Firebase Admin initialized with application default credentials');
      } else {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
      }
    } catch (error) {
      this.logger.warn('FCM initialization failed:', error.message);
    }
  }

  async sendNotification(data: NotificationData): Promise<boolean> {
    try {
      if (data.userId) {
        const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
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

      const result = await this.resend.emails.send({
        from: 'HariHariBol <noreply@hariharibol.com>',
        to: email,
        subject: data.title,
        html: this.buildEmailTemplate(data),
      });

      if (result.error) {
        this.logger.error(`Resend error for ${email}: ${result.error.message}`);
        return false;
      }

      this.logger.log(`Email sent to ${email}: ${data.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      return false;
    }
  }

  private buildEmailTemplate(data: NotificationData): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:serif;background:#FFF8EC;margin:0;padding:20px}
.container{max-width:600px;margin:auto;background:white;border-radius:12px;padding:32px;border-top:4px solid #C75A1A}
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
      if (!this.fcmInitialized) {
        this.logger.warn(`Push skipped (FCM not configured) for user ${userId}`);
        return false;
      }

      // Get all device FCM tokens for this user
      const devices = await this.prisma.device.findMany({
        where: { userIds: { has: userId }, isBanned: false },
        select: { fcmToken: true },
      });

      const tokens = devices.map((d) => d.fcmToken).filter(Boolean) as string[];
      if (!tokens.length) {
        this.logger.warn(`No FCM tokens found for user ${userId}`);
        return false;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title: data.title, body: data.message },
        data: data.metadata
          ? Object.fromEntries(Object.entries(data.metadata).map(([k, v]) => [k, String(v)]))
          : undefined,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`Push sent to ${response.successCount}/${tokens.length} devices for user ${userId}`);
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`Failed to send push notification:`, error);
      return false;
    }
  }

  private async storeInAppNotification(data: NotificationData): Promise<boolean> {
    try {
      if (!data.userId) {
        this.logger.warn('storeInAppNotification called without userId — skipped');
        return false;
      }
      await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          metadata: data.metadata ?? undefined,
        },
      });
      this.logger.log(`In-app notification stored for ${data.userId}: ${data.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store in-app notification:`, error);
      return false;
    }
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0): Promise<any[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.notification.findUnique({ where: { id: notificationId } });
      if (!existing) return false;
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read:`, error);
      return false;
    }
  }

  async subscribeToTopic(deviceToken: string, topic: string): Promise<boolean> {
    try {
      if (!this.fcmInitialized) {
        this.logger.warn('FCM not initialized — topic subscription skipped');
        return false;
      }

      await admin.messaging().subscribeToTopic([deviceToken], topic);
      this.logger.log(`Device subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(deviceToken: string, topic: string): Promise<boolean> {
    try {
      if (!this.fcmInitialized) return false;
      await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
      this.logger.log(`Device unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic:`, error);
      return false;
    }
  }

  async sendTopicNotification(topic: string, data: NotificationData): Promise<boolean> {
    try {
      if (!this.fcmInitialized) {
        this.logger.warn(`FCM not initialized — topic notification skipped: ${topic}`);
        return true; // Graceful degradation
      }

      const message: admin.messaging.Message = {
        topic,
        notification: { title: data.title, body: data.message },
        data: data.metadata
          ? Object.fromEntries(Object.entries(data.metadata).map(([k, v]) => [k, String(v)]))
          : undefined,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      };

      const messageId = await admin.messaging().send(message);
      this.logger.log(`Topic notification sent to ${topic}: ${messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send topic notification:`, error);
      return false;
    }
  }

  // ── Convenience helpers ───────────────────────────────────────────────────

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

  /** Broadcast verse-of-day to a sampraday FCM topic */
  async broadcastVerseOfDayToSampraday(sampradaySlug: string, title: string, body: string, verseId: string): Promise<boolean> {
    const topic = `vod_${sampradaySlug}`;
    return this.sendTopicNotification(topic, {
      topic,
      type: 'push',
      title,
      message: body,
      metadata: { action: 'verse_of_day', verseId },
    });
  }

  /** Broadcast verse-of-day to global topic (users with no sampraday preference) */
  async broadcastVerseOfDayGlobal(title: string, body: string, verseId: string): Promise<boolean> {
    return this.sendTopicNotification('verse_of_day', {
      topic: 'verse_of_day',
      type: 'push',
      title,
      message: body,
      metadata: { action: 'verse_of_day', verseId },
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

  async notifyVerseOfDayUpdate(): Promise<boolean> {
    return this.broadcastVerseOfDayGlobal(
      '🙏 Verse of the Day',
      'A new spiritual verse has been selected for today.',
      '',
    );
  }
}
