import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  private readonly logger = new Logger('PushService');

  constructor() {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        });
      }
    } catch (error) {
      this.logger.warn('Firebase not initialized (local dev mode)', error.message);
    }
  }

  async sendToDevice(fcmToken: string, data: { title: string; body: string }): Promise<void> {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: data.title,
          body: data.body,
        },
      });
      this.logger.log(`Notification sent to device: ${fcmToken}`);
    } catch (error) {
      this.logger.error('Failed to send notification', error);
    }
  }

  async sendToTopic(topic: string, data: { title: string; body: string }): Promise<void> {
    try {
      await admin.messaging().send({
        topic,
        notification: {
          title: data.title,
          body: data.body,
        },
      });
      this.logger.log(`Notification sent to topic: ${topic}`);
    } catch (error) {
      this.logger.error('Failed to send notification to topic', error);
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${tokens.length} devices to topic: ${topic}`);
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', error);
    }
  }
}
