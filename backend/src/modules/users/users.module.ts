import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
