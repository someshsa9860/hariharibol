import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { ModerationService } from '@modules/moderation/moderation.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  async createMessage(groupId: string, userId: string, content: string) {
    const moderation = await this.moderationService.moderateContent(content);
    const status = moderation.safe ? 'approved' : 'pending';

    const message = await this.prisma.message.create({
      data: {
        groupId,
        userId,
        content,
        status,
        aiVerdict: moderation.verdict,
        aiConfidence: moderation.confidence,
        aiReason: moderation.reason,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Message created in group ${groupId} by user ${userId}, status=${status}`);
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
