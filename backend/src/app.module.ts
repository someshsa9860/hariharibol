import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';

import { PrismaModule } from '@infrastructure/database/prisma.module';
import { QueueModule } from '@infrastructure/queue/queue.module';
import { AIProviderModule } from '@infrastructure/ai/ai-provider.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { PushModule } from '@infrastructure/push/push.module';

import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { SampradayasModule } from '@modules/sampradayas/sampradayas.module';
import { BooksModule } from '@modules/books/books.module';
import { VersesModule } from '@modules/verses/verses.module';
import { NarrationsModule } from '@modules/narrations/narrations.module';
import { MantrasModule } from '@modules/mantras/mantras.module';
import { ChantingModule } from '@modules/chanting/chanting.module';
import { FavoritesModule } from '@modules/favorites/favorites.module';
import { TranslationsModule } from '@modules/translations/translations.module';
import { LanguagesModule } from '@modules/languages/languages.module';
import { RecommendationsModule } from '@modules/recommendations/recommendations.module';
import { GroupsModule } from '@modules/groups/groups.module';
import { MessagesModule } from '@modules/messages/messages.module';
import { ModerationModule } from '@modules/moderation/moderation.module';
import { BansModule } from '@modules/bans/bans.module';
import { ChatbotModule } from '@modules/chatbot/chatbot.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { AdminModule } from '@modules/admin/admin.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';

import { HealthController } from '@common/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => [
        { name: 'login', ttl: 60000, limit: 10 },
        { name: 'refresh', ttl: 60000, limit: 3 },
        { name: 'default', ttl: 60000, limit: 100 },
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST') || 'localhost',
        port: configService.get('REDIS_PORT') || 6379,
        ttl: 3600,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        },
      }),
    }),

    // Infrastructure modules
    PrismaModule,
    QueueModule,
    AIProviderModule,
    StorageModule,
    PushModule,

    // Feature modules
    AuthModule,
    UsersModule,
    SampradayasModule,
    BooksModule,
    VersesModule,
    NarrationsModule,
    MantrasModule,
    ChantingModule,
    FavoritesModule,
    TranslationsModule,
    LanguagesModule,
    RecommendationsModule,
    GroupsModule,
    MessagesModule,
    ModerationModule,
    BansModule,
    ChatbotModule,
    NotificationsModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
