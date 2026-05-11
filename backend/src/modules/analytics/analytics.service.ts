import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

export interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers24h: number;
  totalVerses: number;
  totalChants: number;
  topSampradayas: { id: string; name: string; followerCount: number }[];
  topVerses: { id: string; verseId: string; favoriteCount: number }[];
  userGrowth: { date: string; users: number }[];
  // Computed convenience fields
  dau: number;
  mau: number;
  topVerse: string;
  // Legacy fields kept for backwards compatibility
  activeUsers: number;
  newUsersToday: number;
  totalSampradayas: number;
  totalFollows: number;
  totalFavorites: number;
  averageSessionDuration: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('AnalyticsService');

  constructor(private prisma: PrismaService) {}

  async getMetrics(period: 'day' | 'week' | 'month' = 'month'): Promise<AnalyticsMetrics> {
    try {
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers24h,
        mau,
        newUsersToday,
        totalVerses,
        totalSampradayas,
        totalFollows,
        totalFavorites,
        totalChantsAgg,
        topSampradayRows,
        topVerseRows,
        userGrowth,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { lastActiveAt: { gte: cutoff24h } } }),
        this.prisma.user.count({ where: { lastActiveAt: { gte: cutoff30d } } }),
        this.getNewUsersToday(),
        this.prisma.verse.count(),
        this.prisma.sampraday.count(),
        this.prisma.follow.count(),
        this.prisma.favorite.count(),
        this.prisma.chantLog.aggregate({ _sum: { count: true } }),
        this.prisma.sampraday.findMany({
          orderBy: { followerCount: 'desc' },
          take: 5,
          select: { id: true, nameKey: true, followerCount: true },
        }),
        this.prisma.verse.findMany({
          orderBy: { favorites: { _count: 'desc' } },
          take: 5,
          select: {
            id: true,
            verseId: true,
            _count: { select: { favorites: true } },
          },
        }),
        this.getUserGrowth(30),
      ]);

      const topVerseMapped = topVerseRows.map((v) => ({
        id: v.id,
        verseId: v.verseId,
        favoriteCount: v._count.favorites,
      }));

      return {
        totalUsers,
        activeUsers24h,
        activeUsers: activeUsers24h,
        dau: activeUsers24h,
        mau,
        newUsersToday,
        totalVerses,
        totalSampradayas,
        totalFollows,
        totalFavorites,
        totalChants: totalChantsAgg._sum.count ?? 0,
        topSampradayas: topSampradayRows.map((s) => ({
          id: s.id,
          name: s.nameKey,
          followerCount: s.followerCount,
        })),
        topVerses: topVerseMapped,
        topVerse: topVerseMapped[0]?.verseId ?? '—',
        userGrowth,
        averageSessionDuration: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch metrics:`, error);
      throw error;
    }
  }

  async getDau(days = 30): Promise<{ date: string; dau: number }[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);

      const grouped = await this.prisma.chantLog.groupBy({
        by: ['date'],
        where: { date: { gte: cutoff } },
        _count: { _all: true },
        orderBy: { date: 'asc' },
      });

      const result: { date: string; dau: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const found = grouped.find(
          (g) => new Date(g.date).toISOString().split('T')[0] === dateStr,
        );
        result.push({ date: dateStr, dau: found ? found._count._all : 0 });
      }
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch DAU:`, error);
      return [];
    }
  }

  async getTopVerses(limit = 5): Promise<{ name: string; views: number }[]> {
    try {
      const verses = await this.prisma.verse.findMany({
        take: limit,
        orderBy: { favorites: { _count: 'desc' } },
        select: { verseId: true, _count: { select: { favorites: true } } },
      });
      return verses.map((v) => ({ name: v.verseId, views: v._count.favorites }));
    } catch (error) {
      this.logger.error(`Failed to fetch top verses:`, error);
      return [];
    }
  }

  async getTopSampradayas(limit = 5): Promise<{ name: string; followers: number }[]> {
    try {
      const samps = await this.prisma.sampraday.findMany({
        take: limit,
        orderBy: { followerCount: 'desc' },
        select: { nameKey: true, followerCount: true },
      });
      return samps.map((s) => ({ name: s.nameKey, followers: s.followerCount }));
    } catch (error) {
      this.logger.error(`Failed to fetch top sampradayas:`, error);
      return [];
    }
  }

  async getDailyChants(days = 14): Promise<{ date: string; chants: number }[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);

      const grouped = await this.prisma.chantLog.groupBy({
        by: ['date'],
        where: { date: { gte: cutoff } },
        _sum: { count: true },
        orderBy: { date: 'asc' },
      });

      const result: { date: string; chants: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const found = grouped.find(
          (g) => new Date(g.date).toISOString().split('T')[0] === dateStr,
        );
        result.push({ date: dateStr, chants: found?._sum.count ?? 0 });
      }
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch daily chants:`, error);
      return [];
    }
  }

  async getTopMantras(limit = 5): Promise<{ name: string; chantCount: number }[]> {
    try {
      const grouped = await this.prisma.chantLog.groupBy({
        by: ['mantraId'],
        _sum: { count: true },
        orderBy: { _sum: { count: 'desc' } },
        take: limit,
      });

      const mantraIds = grouped.map((g) => g.mantraId);
      const mantras = await this.prisma.mantra.findMany({
        where: { id: { in: mantraIds } },
        select: { id: true, nameKey: true },
      });

      return grouped.map((g) => ({
        name: mantras.find((m) => m.id === g.mantraId)?.nameKey ?? g.mantraId,
        chantCount: g._sum.count ?? 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch top mantras:`, error);
      return [];
    }
  }

  async getUserGrowth(days = 30): Promise<{ date: string; users: number }[]> {
    try {
      const results: { date: string; users: number }[] = [];
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await this.prisma.user.count({
          where: { createdAt: { gte: date, lt: nextDate } },
        });

        results.push({ date: date.toISOString().split('T')[0], users: count });
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to fetch user growth:`, error);
      return [];
    }
  }

  async getEngagementMetrics(): Promise<any> {
    try {
      const [totalSessions, totalFavorites, totalFollows, totalUsers] = await Promise.all([
        this.prisma.device.count(),
        this.prisma.favorite.count(),
        this.prisma.follow.count(),
        this.prisma.user.count(),
      ]);

      return {
        totalSessions,
        totalFavorites,
        totalFollows,
        averageFavoritesPerUser: totalUsers > 0 ? (totalFavorites / totalUsers).toFixed(2) : 0,
        averageFollowsPerUser: totalUsers > 0 ? (totalFollows / totalUsers).toFixed(2) : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch engagement metrics:`, error);
      throw error;
    }
  }

  async getTopContent(limit = 10): Promise<any[]> {
    try {
      const topVerses = await this.prisma.verse.findMany({
        take: limit,
        include: { _count: { select: { favorites: true } } },
        orderBy: { favorites: { _count: 'desc' } },
      });

      return topVerses.map((v) => ({
        id: v.id,
        title: v.transliteration,
        favorites: v._count.favorites,
        type: 'verse',
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch top content:`, error);
      return [];
    }
  }

  async getBannedUsersCount(): Promise<number> {
    try {
      return await this.prisma.user.count({ where: { isBanned: true } });
    } catch (error) {
      this.logger.error(`Failed to fetch banned users count:`, error);
      return 0;
    }
  }

  private async getNewUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.user.count({ where: { createdAt: { gte: today, lt: tomorrow } } });
  }
}
