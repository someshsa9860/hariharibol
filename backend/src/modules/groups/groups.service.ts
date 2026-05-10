import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(private prisma: PrismaService) {}

  async getGroups(sampradayId?: string, skip = 0, take = 20) {
    const where = {
      isActive: true,
      ...(sampradayId ? { sampradayId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take,
        include: {
          sampraday: { select: { id: true, slug: true, nameKey: true, thumbnailUrl: true } },
          _count: { select: { members: true, messages: true } },
        },
        orderBy: { memberCount: 'desc' },
      }),
      this.prisma.group.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getGroup(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        sampraday: { select: { id: true, slug: true, nameKey: true, thumbnailUrl: true } },
        _count: { select: { members: true, messages: true } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async joinGroup(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.isActive) throw new NotFoundException('Group not found');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) throw new ConflictException('Already a member of this group');

    const [member] = await this.prisma.$transaction([
      this.prisma.groupMember.create({
        data: { groupId, userId, role: 'member' },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    this.logger.log(`User ${userId} joined group ${groupId}`);
    return member;
  }

  async leaveGroup(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new BadRequestException('Not a member of this group');

    await this.prisma.$transaction([
      this.prisma.groupMember.delete({
        where: { groupId_userId: { groupId, userId } },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    this.logger.log(`User ${userId} left group ${groupId}`);
    return { success: true };
  }

  async getGroupMembers(groupId: string, skip = 0, take = 50) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const [data, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.groupMember.count({ where: { groupId } }),
    ]);

    return { data, total, skip, take };
  }
}
