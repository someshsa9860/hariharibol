import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';
import * as admin from 'firebase-admin';

export interface FCMMessage {
  topic?: string;
  tokens?: string[];
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
}

@Injectable()
export class FCMService {
  private readonly logger = new Logger('FCMService');
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initialize();
  }

  private initialize(): void {
    try {
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        this.initialized = true;
        this.logger.log('FCM initialized with service account credentials');
      } else if (projectId) {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
        this.initialized = true;
        this.logger.log('FCM initialized with application default credentials');
      } else {
        this.logger.warn('FCM configuration pending — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID');
      }
    } catch (error) {
      this.logger.warn('FCM initialization failed:', error.message);
    }
  }

  async sendToTopic(message: FCMMessage): Promise<boolean> {
    if (!this.initialized || !message.topic) {
      this.logger.debug(`Topic notification skipped (FCM not ready): ${message.topic}`);
      return false;
    }

    try {
      const fcmMessage: admin.messaging.Message = {
        topic: message.topic,
        notification: message.notification,
        data: message.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      };

      const messageId = await admin.messaging().send(fcmMessage);
      this.logger.log(`Notification sent to topic ${message.topic}: ${messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send topic notification:`, error);
      return false;
    }
  }

  async sendToDevices(tokens: string[], message: Omit<FCMMessage, 'topic'>): Promise<number> {
    if (!tokens || tokens.length === 0) {
      return 0;
    }

    if (!this.initialized) {
      this.logger.debug(`Device notification skipped (FCM not ready) for ${tokens.length} devices`);
      return 0;
    }

    try {
      const batchSize = 500;
      let successCount = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        const multicast: admin.messaging.MulticastMessage = {
          tokens: batch,
          notification: message.notification,
          data: message.data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        };

        const response = await admin.messaging().sendEachForMulticast(multicast);
        successCount += response.successCount;
        this.logger.log(`Sent to ${response.successCount}/${batch.length} devices in batch`);
      }

      return successCount;
    } catch (error) {
      this.logger.error('Failed to send multicast notification:', error);
      return 0;
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!tokens || tokens.length === 0) {
      return false;
    }

    try {
      if (this.initialized) {
        await admin.messaging().subscribeToTopic(tokens, topic);
      }

      const fcmTopic = await this.prisma.fcmTopic.findUnique({ where: { name: topic } });
      if (!fcmTopic) {
        this.logger.warn(`Topic not found in DB: ${topic}`);
        return this.initialized;
      }

      await Promise.all(
        tokens.map((deviceToken) =>
          this.prisma.fcmSubscription.upsert({
            where: { topicId_deviceToken: { topicId: fcmTopic.id, deviceToken } },
            create: { topicId: fcmTopic.id, deviceToken, deviceId: deviceToken },
            update: {},
          }),
        ),
      );

      this.logger.log(`${tokens.length} devices subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!tokens || tokens.length === 0) {
      return false;
    }

    try {
      if (this.initialized) {
        await admin.messaging().unsubscribeFromTopic(tokens, topic);
      }

      const fcmTopic = await this.prisma.fcmTopic.findUnique({ where: { name: topic } });
      if (fcmTopic) {
        await this.prisma.fcmSubscription.deleteMany({
          where: { topicId: fcmTopic.id, deviceToken: { in: tokens } },
        });
      }

      this.logger.log(`${tokens.length} devices unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic:`, error);
      return false;
    }
  }

  async createTopic(name: string, description?: string): Promise<boolean> {
    try {
      const existing = await this.prisma.fcmTopic.findUnique({
        where: { name },
      });

      if (existing) {
        this.logger.warn(`Topic already exists: ${name}`);
        return false;
      }

      await this.prisma.fcmTopic.create({
        data: {
          name,
          description,
        },
      });

      this.logger.log(`Topic created: ${name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create topic:`, error);
      return false;
    }
  }

  async deleteTopic(name: string): Promise<boolean> {
    try {
      await this.prisma.fcmTopic.delete({
        where: { name },
      });

      this.logger.log(`Topic deleted: ${name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete topic:`, error);
      return false;
    }
  }

  async getTopicSubscriberCount(topicName: string): Promise<number> {
    try {
      const topic = await this.prisma.fcmTopic.findUnique({
        where: { name: topicName },
        include: {
          subscriptions: {
            select: { id: true },
          },
        },
      });

      return topic?.subscriptions.length || 0;
    } catch (error) {
      this.logger.error(`Failed to get subscriber count:`, error);
      return 0;
    }
  }

  async getDefaultTopics(): Promise<string[]> {
    const defaultTopics = ['verse-of-day', 'announcements', 'reminders'];

    for (const topic of defaultTopics) {
      const exists = await this.prisma.fcmTopic.findUnique({
        where: { name: topic },
      });

      if (!exists) {
        await this.createTopic(topic, `Auto-created default topic: ${topic}`);
      }
    }

    return defaultTopics;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStatus(): {
    initialized: boolean;
    message: string;
  } {
    return {
      initialized: this.initialized,
      message: this.initialized
        ? 'FCM is ready'
        : 'FCM configuration pending. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID',
    };
  }
}
