import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { CreateSampradayDto, UpdateSampradayDto } from './dto/create-sampraday.dto';
import { CreateBookDto, UpdateBookDto, CreateChapterDto, UpdateChapterDto, CreateVerseDto, UpdateVerseDto } from './dto/book.dto';
import { BooksService } from '../books/books.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('api/v1/admin')
@UseGuards(JwtGuard, AdminGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private booksService: BooksService,
  ) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('audit-log')
  @HttpCode(HttpStatus.OK)
  async getAuditLog(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAuditLogs(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
      action || undefined,
      entityType || undefined,
      dateFrom || undefined,
      dateTo || undefined,
    );
  }

  // Sampraday Management
  @Post('sampradayas')
  @HttpCode(HttpStatus.CREATED)
  async createSampraday(
    @CurrentUser() user: any,
    @Body() dto: CreateSampradayDto,
  ) {
    return this.adminService.createSampraday(dto);
  }

  @Get('sampradayas')
  @HttpCode(HttpStatus.OK)
  async getAllSampradayas(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.getAllSampradayas(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Patch('sampradayas/:id')
  @HttpCode(HttpStatus.OK)
  async updateSampraday(
    @CurrentUser() user: any,
    @Param('id') sampradayId: string,
    @Body() dto: UpdateSampradayDto,
  ) {
    return this.adminService.updateSampraday(sampradayId, dto);
  }

  @Delete('sampradayas/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSampraday(
    @CurrentUser() user: any,
    @Param('id') sampradayId: string,
  ) {
    return this.adminService.deleteSampraday(sampradayId);
  }

  // User Management
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getAllUsers(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.getAllUsers(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() dto: { reason: string },
  ) {
    return this.adminService.banUser(userId, dto.reason);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(
    @CurrentUser() user: any,
    @Param('id') userId: string,
  ) {
    return this.adminService.unbanUser(userId);
  }

  // Moderation Queue
  @Get('moderation/queue')
  @HttpCode(HttpStatus.OK)
  async getModerationQueue(
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.getModerationQueue(
      status,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Post('moderation/messages/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveMessage(
    @CurrentUser() user: any,
    @Param('id') messageId: string,
  ) {
    return this.adminService.approveMessage(messageId);
  }

  @Post('moderation/messages/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectMessage(
    @CurrentUser() user: any,
    @Param('id') messageId: string,
    @Body() dto: { reason: string },
  ) {
    return this.adminService.rejectMessage(messageId, dto.reason);
  }

  // File Upload Endpoints
  @Post('sampradayas/:id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadSampradayImage(
    @CurrentUser() user: any,
    @Param('id') sampradayId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadSampradayImage(
      sampradayId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('books/:id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBookImage(
    @CurrentUser() user: any,
    @Param('id') bookId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadBookImage(
      bookId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('verses/:id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadVerseImage(
    @CurrentUser() user: any,
    @Param('id') verseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadVerseImage(
      verseId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('mantras/:id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMantraImage(
    @CurrentUser() user: any,
    @Param('id') mantraId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadMantraImage(
      mantraId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('narrations/:id/upload-audio')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadNarrationAudio(
    @CurrentUser() user: any,
    @Param('id') narrationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadNarrationAudio(
      narrationId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('users/:id/upload-profile-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserProfileImage(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.adminService.uploadUserProfileImage(
      userId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Delete('files/delete')
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @CurrentUser() user: any,
    @Body() dto: { filePath: string },
  ) {
    return this.adminService.deleteFile(dto.filePath);
  }

  @Delete('folders/delete')
  @HttpCode(HttpStatus.OK)
  async deleteFolder(
    @CurrentUser() user: any,
    @Body() dto: { folderPath: string },
  ) {
    return this.adminService.deleteFolder(dto.folderPath);
  }

  // App Settings
  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() dto: Record<string, string>) {
    return this.adminService.updateSettings(dto);
  }
}
