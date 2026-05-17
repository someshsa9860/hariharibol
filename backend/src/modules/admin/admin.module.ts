import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { BooksModule } from '../books/books.module';
import { AuditModule } from '@infrastructure/audit/audit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '@common/guards/admin.guard';
import { RolesGuard } from '@common/guards/roles.guard';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, BooksModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, RolesGuard],
  exports: [AdminService],
})
export class AdminModule {}
