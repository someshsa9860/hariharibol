import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class SampradayasService {
  constructor(private prisma: PrismaService) {}

  async getAllSampradayas(skip?: number, take?: number) {
    const [sampradayas, total] = await Promise.all([
      this.prisma.sampraday.findMany({
        where: { isPublished: true },
        skip,
        take,
        orderBy: { displayOrder: 'asc' },
        include: {
          follows: true,
          _count: {
            select: { follows: true, mantras: true },
          },
        },
      }),
      this.prisma.sampraday.count({ where: { isPublished: true } }),
    ]);

    return {
      data: sampradayas,
      total,
      skip: skip || 0,
      take: take || total,
    };
  }

  async getSampradayBySlug(slug: string) {
    return this.getSampraday(slug);
  }

  async getSampraday(idOrSlug: string) {
    const isId = /^c[a-z0-9]{24,}$/.test(idOrSlug);

    const sampraday = isId
      ? await this.prisma.sampraday.findUnique({
          where: { id: idOrSlug },
          include: {
            mantras: { where: { isPublic: true }, take: 10 },
            verseLinks: { include: { verse: true }, take: 10 },
            _count: { select: { follows: true, mantras: true, verseLinks: true } },
          },
        })
      : await this.prisma.sampraday.findUnique({
          where: { slug: idOrSlug },
          include: {
            mantras: { where: { isPublic: true }, take: 10 },
            verseLinks: { include: { verse: true }, take: 10 },
            _count: { select: { follows: true, mantras: true, verseLinks: true } },
          },
        });

    if (!sampraday) throw new BadRequestException('Sampraday not found');
    return sampraday;
  }

  async followSampraday(userId: string, sampradayId: string) {
    const existingFollow = await this.prisma.follow.findFirst({
      where: { userId, sampradayId },
    });

    if (existingFollow) {
      throw new BadRequestException('Already following this sampraday');
    }

    const follow = await this.prisma.follow.create({
      data: {
        userId,
        sampradayId,
      },
    });

    // Update follower count
    await this.prisma.sampraday.update({
      where: { id: sampradayId },
      data: {
        followerCount: {
          increment: 1,
        },
      },
    });

    return follow;
  }

  async unfollowSampraday(userId: string, sampradayId: string) {
    const follow = await this.prisma.follow.findFirst({
      where: { userId, sampradayId },
    });

    if (!follow) {
      throw new BadRequestException('Not following this sampraday');
    }

    await this.prisma.follow.delete({
      where: { id: follow.id },
    });

    // Update follower count
    await this.prisma.sampraday.update({
      where: { id: sampradayId },
      data: {
        followerCount: {
          decrement: 1,
        },
      },
    });

    return { success: true };
  }

  async getUserFollowedSampradayas(userId: string) {
    return this.prisma.sampraday.findMany({
      where: {
        follows: { some: { userId } },
        isPublished: true,
      },
      include: {
        _count: { select: { follows: true, mantras: true } },
      },
    });
  }
}
