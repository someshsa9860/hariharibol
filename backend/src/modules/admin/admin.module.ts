import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { BooksModule } from '../books/books.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '@common/guards/admin.guard';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, BooksModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
