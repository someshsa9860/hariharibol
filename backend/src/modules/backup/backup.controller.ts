import { Controller, Post, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';

@ApiTags('Backup')
@Controller('api/v1/admin/backup')
@UseGuards(JwtGuard, AdminGuard)
export class BackupController {
  constructor(private backupService: BackupService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger database backup' })
  @ApiResponse({
    status: 200,
    description: 'Backup triggered successfully',
    schema: {
      example: {
        success: true,
        message: 'manual backup completed successfully',
      },
    },
  })
  async triggerBackup() {
    return this.backupService.manualBackup('manual');
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get backup status and last backup times' })
  @ApiResponse({
    status: 200,
    description: 'Backup status retrieved',
    schema: {
      example: {
        lastNightlyBackup: '2026-05-25T02:00:00.000Z',
        lastAfternoonBackup: '2026-05-25T16:30:00.000Z',
        totalBackups: 45,
      },
    },
  })
  async getBackupStatus() {
    return this.backupService.getBackupStatus();
  }
}
