import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'moderation' },
      { name: 'notifications' },
      { name: 'affinity-calculation' },
      { name: 'email' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
