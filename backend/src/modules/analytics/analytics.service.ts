import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

export interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalVerses: number;
  totalSampradayas: number;
  totalFollows: number;
  totalFavorites: number;
  averageSessionDuration: number;
  chartData?: any;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('AnalyticsService');

  constructor(private prisma: PrismaService) {}

  async getMetrics(period: 'day' | 'week' | 'month' = 'month'): Promise<AnalyticsMetrics> {
    try {
      const [
        totalUsers,
        activeUsers,
        newUsersToday,
        totalVerses,
        totalSampradayas,
        totalFollows,
        totalFavorites,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.getActiveUsers(period),
        this.getNewUsersToday(),
        this.prisma.verse.count(),
        this.prisma.sampraday.count(),
        this.prisma.userFollowSampraday.count(),
        this.prisma.userFavorite.count(),
      ]);

      return {
        totalUsers,
        activeUsers,
        newUsersToday,
        totalVerses,
        totalSampradayas,
        totalFollows,
        totalFavorites,
        averageSessionDuration: 0, // TODO: Calculate from session data
      };
    } catch (error) {
      this.logger.error(`Failed to fetch metrics:`, error);
      throw error;
    }
  }

  async getUserGrowth(days: number = 30): Promise<any[]> {
    try {
      const data: any[] = [];
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await this.prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        });

        data.push({
          date: date.toISOString().split('T')[0],
          users: count,
        });
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch user growth data:`, error);
      return [];
    }
  }

  async getEngagementMetrics(): Promise<any> {
    try {
      const [totalSessions, totalFavorites, totalFollows] = await Promise.all([
        this.prisma.device.count(), // Assuming one session per device
        this.prisma.userFavorite.count(),
        this.prisma.userFollowSampraday.count(),
      ]);

      return {
        totalSessions,
        totalFavorites,
        totalFollows,
        averageFavoritesPerUser: totalFavorites > 0 ? (totalFavorites / await this.prisma.user.count()).toFixed(2) : 0,
        averageFollowsPerUser: totalFollows > 0 ? (totalFollows / await this.prisma.user.count()).toFixed(2) : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch engagement metrics:`, error);
      throw error;
    }
  }

  async getTopContent(limit: number = 10): Promise<any[]> {
    try {
      const topVerses = await this.prisma.verse.findMany({
        take: limit,
        include: {
          _count: {
            select: { favorites: true },
          },
        },
        orderBy: {
          favorites: {
            _count: 'desc',
          },
        },
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
      return await this.prisma.user.count({
        where: { isBanned: true },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch banned users count:`, error);
      return 0;
    }
  }

  private async getActiveUsers(period: 'day' | 'week' | 'month'): Promise<number> {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setDate(date.getDate() - 30);
        break;
    }

    return await this.prisma.user.count({
      where: {
        lastActiveAt: {
          gte: date,
        },
      },
    });
  }

  private async getNewUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.user.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }
}
