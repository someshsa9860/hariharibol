import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private prisma: PrismaService) {}

  async createMessage(groupId: string, userId: string, content: string) {
    const message = await this.prisma.message.create({
      data: { groupId, userId, content, status: 'pending' },
    });
    return message;
  }

  async getGroupMessages(groupId: string, skip = 0, take = 50) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { groupId, status: 'approved' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.message.count({ where: { groupId, status: 'approved' } }),
    ]);

    return { data: data.reverse(), total, skip, take };
  }

  async updateMessageStatus(
    messageId: string,
    status: 'approved' | 'hidden',
    moderationData?: {
      aiVerdict?: string;
      aiConfidence?: number;
      aiReason?: string;
      hiddenReason?: string;
    },
  ) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        status,
        ...moderationData,
      },
    });
  }
}
