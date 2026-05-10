import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MantrasController } from './mantras.controller';
import { MantrasService } from './mantras.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MantrasController],
  providers: [MantrasService],
  exports: [MantrasService],
})
export class MantrasModule {}
