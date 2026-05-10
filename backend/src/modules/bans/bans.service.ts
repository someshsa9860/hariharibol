import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { Server } from 'socket.io';

@Injectable()
export class BansService {
  private readonly logger = new Logger(BansService.name);
  private socketServer: Server | null = null;

  constructor(private prisma: PrismaService) {}

  setSocketServer(server: Server) {
    this.socketServer = server;
  }

  async banUser(
    userId: string,
    reason: string,
    triggeredBy: 'ai' | 'admin',
    options?: { adminId?: string; evidenceMessageIds?: string[] },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.isBanned) return null; // already banned, avoid duplicate work

    // Create/update email ban
    const emailBan = await this.prisma.ban.upsert({
      where: { unique_ban: { type: 'email', value: user.email } },
      update: { isActive: true, reason, unbannedAt: null, unbannedBy: null, unbanReason: null },
      create: {
        type: 'email',
        value: user.email,
        reason,
        triggeredBy,
        adminId: options?.adminId ?? null,
        evidenceMessageIds: options?.evidenceMessageIds ?? [],
        cascadeChain: [],
      },
    });

    // Ban all devices associated with this user
    const devices = await this.prisma.device.findMany({
      where: { userIds: { has: userId } },
    });

    for (const device of devices) {
      await this.prisma.ban.upsert({
        where: { unique_ban: { type: 'device', value: device.deviceId } },
        update: { isActive: true, reason, unbannedAt: null },
        create: {
          type: 'device',
          value: device.deviceId,
          reason,
          triggeredBy,
          adminId: options?.adminId ?? null,
          cascadedFromId: emailBan.id,
          cascadeChain: [emailBan.id],
          evidenceMessageIds: options?.evidenceMessageIds ?? [],
        },
      });

      await this.prisma.device.update({
        where: { id: device.id },
        data: { isBanned: true, bannedReason: reason, bannedAt: new Date() },
      });
    }

    // Mark user as banned
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedReason: reason, bannedAt: new Date() },
    });

    // Hide all of the user's messages that aren't already hidden
    await this.prisma.message.updateMany({
      where: { userId, status: { not: 'hidden' } },
      data: { status: 'hidden', hiddenReason: `User banned: ${reason}` },
    });

    // Kick user from all open WebSocket connections
    if (this.socketServer) {
      this.socketServer.to(`user:${userId}`).emit('banned', {
        reason,
        message: 'You have been banned from this platform.',
      });
      const sockets = await this.socketServer.in(`user:${userId}`).fetchSockets();
      sockets.forEach((s) => s.disconnect(true));
    }

    this.logger.log(`User ${userId} banned (${triggeredBy}): ${reason}`);
    return emailBan;
  }

  async unbanUser(banId: string, reason: string, adminId?: string) {
    const ban = await this.prisma.ban.findUnique({ where: { id: banId } });
    if (!ban) throw new NotFoundException('Ban not found');

    await this.prisma.ban.update({
      where: { id: banId },
      data: {
        isActive: false,
        unbannedAt: new Date(),
        unbanReason: reason,
        unbannedBy: adminId ?? null,
      },
    });

    if (ban.type === 'email') {
      const user = await this.prisma.user.findFirst({ where: { email: ban.value } });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isBanned: false, bannedReason: null, bannedAt: null },
        });

        // Lift cascaded device bans
        await this.prisma.ban.updateMany({
          where: { cascadedFromId: banId, isActive: true },
          data: { isActive: false, unbannedAt: new Date(), unbanReason: reason },
        });

        const devices = await this.prisma.device.findMany({
          where: { userIds: { has: user.id }, isBanned: true },
        });
        for (const device of devices) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: { isBanned: false, bannedReason: null, bannedAt: null },
          });
        }
      }
    }

    this.logger.log(`Ban ${banId} lifted: ${reason}`);
    return { success: true, banId };
  }

  async getActiveBans(skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.ban.findMany({
        where: { isActive: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ban.count({ where: { isActive: true } }),
    ]);
    return { data, total };
  }

  async getBanHistory(skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.ban.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ban.count(),
    ]);
    return { data, total };
  }
}
