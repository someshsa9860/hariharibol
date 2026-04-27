import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { StorageService } from '@infrastructure/storage/storage.service';
import { CreateSampradayDto, UpdateSampradayDto } from './dto/create-sampraday.dto';
import { folderStructure } from '@infrastructure/storage/storage.config';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async getDashboardStats() {
    const [totalUsers, totalSampradayas, totalVerses, bannedUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.sampraday.count({ where: { isPublished: true } }),
      this.prisma.verse.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
    ]);

    const recentUsers = await this.prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, createdAt: true, isBanned: true },
    });

    return {
      totalUsers,
      totalSampradayas,
      totalVerses,
      bannedUsers,
      recentUsers,
    };
  }

  // Sampraday Management
  async createSampraday(dto: CreateSampradayDto) {
    const existing = await this.prisma.sampraday.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Sampraday with this slug already exists');
    }

    return this.prisma.sampraday.create({
      data: {
        slug: dto.slug,
        nameKey: dto.nameKey,
        descriptionKey: dto.descriptionKey,
        founderKey: dto.founderKey,
        primaryDeityKey: dto.primaryDeityKey,
        philosophyKey: dto.philosophyKey,
        heroImageUrl: dto.heroImageUrl,
        thumbnailUrl: dto.thumbnailUrl,
        foundingYear: dto.foundingYear,
        regionKey: dto.regionKey,
        isPublished: dto.isPublished || false,
        displayOrder: dto.displayOrder || 0,
      },
    });
  }

  async updateSampraday(sampradayId: string, dto: UpdateSampradayDto) {
    return this.prisma.sampraday.update({
      where: { id: sampradayId },
      data: dto,
    });
  }

  async deleteSampraday(sampradayId: string) {
    return this.prisma.sampraday.delete({
      where: { id: sampradayId },
    });
  }

  async getAllSampradayas(skip?: number, take?: number) {
    const [sampradayas, total] = await Promise.all([
      this.prisma.sampraday.findMany({
        skip,
        take,
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: {
            select: { follows: true, mantras: true, verseRelations: true },
          },
        },
      }),
      this.prisma.sampraday.count(),
    ]);

    return { data: sampradayas, total };
  }

  // User Management
  async getAllUsers(skip?: number, take?: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          isBanned: true,
          bannedReason: true,
          bannedAt: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { data: users, total };
  }

  async banUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Ban user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedReason: reason,
        bannedAt: new Date(),
      },
    });

    // Create ban record
    await this.prisma.ban.create({
      data: {
        type: 'email',
        value: user.email,
        reason,
        triggeredBy: 'admin',
        isActive: true,
      },
    });

    // Ban all associated devices
    const devices = await this.prisma.device.findMany({
      where: {
        userIds: {
          hasSome: [userId],
        },
      },
    });

    for (const device of devices) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          isBanned: true,
          bannedReason: `Associated with banned user: ${reason}`,
          bannedAt: new Date(),
        },
      });
    }

    return { success: true, message: 'User and associated devices banned' };
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Unban user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedReason: null,
        bannedAt: null,
      },
    });

    // Remove ban record
    await this.prisma.ban.updateMany({
      where: {
        type: 'email',
        value: user.email,
        isActive: true,
      },
      data: {
        isActive: false,
        unbannedAt: new Date(),
      },
    });

    return { success: true, message: 'User unbanned' };
  }

  // Moderation Queue
  async getModerationQueue(status?: string, skip?: number, take?: number) {
    const where: any = {};

    if (status === 'pending') {
      where.isModerated = false;
    } else if (status === 'approved') {
      where.isModerated = true;
      where.isFlagged = false;
    } else if (status === 'rejected') {
      where.isModerated = true;
      where.isFlagged = true;
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return { data: messages, total };
  }

  async approveMessage(messageId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        isModerated: true,
        isFlagged: false,
      },
    });
  }

  async rejectMessage(messageId: string, reason: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        isModerated: true,
        isFlagged: true,
        flagReason: reason,
      },
    });
  }

  // Verify admin user
  async verifyAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // TODO: Add admin role checking when admin table is created
    return !!user && !user.isBanned;
  }

  // File Upload Methods
  async uploadSampradayImage(sampradayId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.sampraday(sampradayId);
    return this.storageService.uploadImage(buffer, filename, folder, mimetype);
  }

  async uploadBookImage(bookId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.book(bookId);
    return this.storageService.uploadImage(buffer, filename, folder, mimetype);
  }

  async uploadVerseImage(verseId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.verse(verseId);
    return this.storageService.uploadImage(buffer, filename, folder, mimetype);
  }

  async uploadMantraImage(mantraId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.mantra(mantraId);
    return this.storageService.uploadImage(buffer, filename, folder, mimetype);
  }

  async uploadNarrationAudio(narrationId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.narration(narrationId);
    return this.storageService.uploadFile(buffer, filename, folder, mimetype);
  }

  async uploadUserProfileImage(userId: string, buffer: Buffer, filename: string, mimetype: string) {
    const folder = folderStructure.user(userId);
    return this.storageService.uploadImage(buffer, filename, folder, mimetype);
  }

  async deleteFile(filePath: string) {
    await this.storageService.deleteFile(filePath);
    return { success: true, message: 'File deleted successfully' };
  }

  async deleteFolder(folderPath: string) {
    await this.storageService.deleteFolder(folderPath);
    return { success: true, message: 'Folder deleted successfully' };
  }
}
