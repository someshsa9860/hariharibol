import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { LogChantDto } from './dto/log-chant.dto';

export interface ChantStats {
  totalChants: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  topMantra: { id: string; name: string; count: number } | null;
}

@Injectable()
export class ChantingService {
  private readonly logger = new Logger('ChantingService');

  constructor(private prisma: PrismaService) {}

  async logChant(userId: string, dto: LogChantDto): Promise<any> {
    const mantra = await this.prisma.mantra.findUnique({ where: { id: dto.mantraId } });
    if (!mantra) {
      throw new NotFoundException(`Mantra ${dto.mantraId} not found`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert today's log for this mantra
    const existing = await this.prisma.chantLog.findFirst({
      where: { userId, mantraId: dto.mantraId, date: today },
    });

    let log: any;
    if (existing) {
      log = await this.prisma.chantLog.update({
        where: { id: existing.id },
        data: {
          count: { increment: dto.count },
          durationSeconds: dto.durationSeconds
            ? { increment: dto.durationSeconds }
            : undefined,
        },
        include: { mantra: { select: { id: true, nameKey: true, category: true } } },
      });
    } else {
      log = await this.prisma.chantLog.create({
        data: {
          userId,
          mantraId: dto.mantraId,
          count: dto.count,
          durationSeconds: dto.durationSeconds,
          date: today,
        },
        include: { mantra: { select: { id: true, nameKey: true, category: true } } },
      });
    }

    this.logger.log(`Chant logged: user=${userId} mantra=${dto.mantraId} count=${dto.count}`);
    return log;
  }

  async getStats(userId: string): Promise<ChantStats> {
    const [totalChants, totalSessions, mantraAgg] = await Promise.all([
      this.prisma.chantLog.aggregate({
        where: { userId },
        _sum: { count: true },
      }),
      this.prisma.chantLog.count({ where: { userId } }),
      this.prisma.chantLog.groupBy({
        by: ['mantraId'],
        where: { userId },
        _sum: { count: true },
        orderBy: { _sum: { count: 'desc' } },
        take: 1,
      }),
    ]);

    const streak = await this.calculateStreak(userId);

    let topMantra: ChantStats['topMantra'] = null;
    if (mantraAgg.length > 0) {
      const mantra = await this.prisma.mantra.findUnique({
        where: { id: mantraAgg[0].mantraId },
        select: { id: true, nameKey: true },
      });
      if (mantra) {
        topMantra = {
          id: mantra.id,
          name: mantra.nameKey,
          count: mantraAgg[0]._sum.count ?? 0,
        };
      }
    }

    return {
      totalChants: totalChants._sum.count ?? 0,
      totalSessions,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      topMantra,
    };
  }

  async getHistory(userId: string, period: 'week' | 'month' | 'all' = 'week'): Promise<any[]> {
    const since = this.getPeriodStart(period);

    return this.prisma.chantLog.findMany({
      where: {
        userId,
        ...(since ? { date: { gte: since } } : {}),
      },
      orderBy: { date: 'desc' },
      include: { mantra: { select: { id: true, nameKey: true, category: true, sampradayId: true } } },
    });
  }

  private async calculateStreak(userId: string): Promise<{ current: number; longest: number }> {
    const logs = await this.prisma.chantLog.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    if (logs.length === 0) return { current: 0, longest: 0 };

    // Deduplicate dates (stored as date-only via @db.Date)
    const uniqueDates = [...new Set(logs.map((l) => new Date(l.date).toISOString().split('T')[0]))]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let current = 0;
    let longest = 0;
    let streak = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Current streak: must include today or yesterday
    const mostRecent = uniqueDates[0];
    const isActive =
      mostRecent.toISOString().split('T')[0] === today.toISOString().split('T')[0] ||
      mostRecent.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0];

    if (!isActive) {
      current = 0;
    } else {
      current = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const diff = uniqueDates[i - 1].getTime() - uniqueDates[i].getTime();
        if (diff === 86400000) {
          current++;
        } else {
          break;
        }
      }
    }

    // Longest streak
    streak = 1;
    longest = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = uniqueDates[i - 1].getTime() - uniqueDates[i].getTime();
      if (diff === 86400000) {
        streak++;
        if (streak > longest) longest = streak;
      } else {
        streak = 1;
      }
    }

    return { current, longest };
  }

  private getPeriodStart(period: 'week' | 'month' | 'all'): Date | null {
    if (period === 'all') return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'week') d.setDate(d.getDate() - 7);
    if (period === 'month') d.setDate(d.getDate() - 30);
    return d;
  }
}
