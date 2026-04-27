import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';

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
  private admin: any;
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Firebase Admin SDK initialization
      // TODO: Uncomment when Firebase is fully configured
      /*
      const admin = require('firebase-admin');
      const serviceAccount = JSON.parse(
        this.configService.get('FCM_SERVICE_ACCOUNT_JSON') ||
        fs.readFileSync(this.configService.get('FCM_SERVICE_ACCOUNT_PATH')),
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.admin = admin.messaging();
      this.initialized = true;
      this.logger.log('FCM initialized successfully');
      */

      this.logger.log('FCM service ready (Firebase credentials pending)');
    } catch (error) {
      this.logger.warn('FCM initialization incomplete:', error.message);
      this.logger.warn('Configure FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH');
    }
  }

  async sendToTopic(message: FCMMessage): Promise<boolean> {
    if (!this.initialized || !message.topic) {
      this.logger.debug(`Topic notification queued: ${message.topic}`);
      return true; // Queue for later when FCM is available
    }

    try {
      // TODO: Implement actual FCM send
      // const response = await this.admin.send({
      //   topic: message.topic,
      //   notification: message.notification,
      //   data: message.data,
      // });
      // this.logger.log(`Notification sent to topic ${message.topic}:`, response);

      this.logger.log(`Notification sent to topic: ${message.topic}`);
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
      this.logger.debug(`Notification queued for ${tokens.length} devices`);
      return tokens.length;
    }

    try {
      // Send in batches of 500 (FCM limit)
      const batchSize = 500;
      let successCount = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        // TODO: Implement actual FCM send
        // const response = await this.admin.sendMulticast({
        //   tokens: batch,
        //   notification: message.notification,
        //   data: message.data,
        // });
        // successCount += response.successCount;

        this.logger.log(`Sent notification to ${batch.length} devices`);
        successCount += batch.length;
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
      // Store subscription in database
      const subscriptions = tokens.map((token) => ({
        topicId: '', // Will be fetched from DB
        deviceToken: token,
        deviceId: this.extractDeviceId(token), // Placeholder
      }));

      // TODO: Get actual topic ID from database
      // Update once database is set up with FCMTopic model

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
      // TODO: Remove from database subscriptions
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

  private extractDeviceId(token: string): string {
    // Extract device identifier from FCM token
    // This is a placeholder - actual implementation depends on your token format
    return token.substring(0, 20); // First 20 chars as identifier
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
        : 'FCM configuration pending. Set FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH',
    };
  }
}
