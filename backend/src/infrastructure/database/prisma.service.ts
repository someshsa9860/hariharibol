import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async reset() {
    const tables = [
      'Citation',
      'ChatbotMessage',
      'ChatbotSession',
      'Message',
      'GroupMember',
      'Group',
      'ChantLog',
      'Follow',
      'Favorite',
      'Narration',
      'VerseRelation',
      'Verse',
      'Chapter',
      'Book',
      'Mantra',
      'Sampraday',
      'Language',
      'Translation',
      'AuditLog',
      'Ban',
      'GuruSignal',
      'Device',
      'User',
      'QueueJob',
    ];

    for (const table of tables) {
      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      } catch (error) {
        this.logger.warn(`Could not truncate ${table}: ${error.message}`);
      }
    }
  }
}
