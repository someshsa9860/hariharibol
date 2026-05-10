import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger('RecommendationsService');

  constructor(private prisma: PrismaService) {}

  async getVerseRecommendations(userId: string, limit = 10): Promise<any[]> {
    try {
      // Gather user signals in parallel
      const [follows, favorites, guruSignal] = await Promise.all([
        this.prisma.follow.findMany({ where: { userId }, select: { sampradayId: true } }),
        this.prisma.favorite.findMany({
          where: { userId, type: 'verse' },
          select: { targetId: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.guruSignal.findUnique({ where: { userId } }),
      ]);

      const followedSampradayIds = follows.map((f) => f.sampradayId);
      const favoritedVerseIds = favorites.map((f) => f.targetId);

      // Step 1: verses linked to followed sampradayas, not already favorited
      let verses: any[] = [];

      if (followedSampradayIds.length > 0) {
        const sampradayVerseLinks = await this.prisma.verseSampradayLink.findMany({
          where: {
            sampradayId: { in: followedSampradayIds },
            verseId: { notIn: favoritedVerseIds },
          },
          select: { verseId: true, sampradayId: true },
          take: limit * 3,
        });

        const sampradayVerseIds = [...new Set(sampradayVerseLinks.map((l) => l.verseId))];

        if (sampradayVerseIds.length > 0) {
          verses = await this.prisma.verse.findMany({
            where: { id: { in: sampradayVerseIds } },
            select: {
              id: true,
              verseId: true,
              sanskrit: true,
              transliteration: true,
              categoryKeys: true,
              chapterNumber: true,
              verseNumber: true,
              bookId: true,
              _count: { select: { favorites: true } },
            },
            take: limit,
          });
        }
      }

      // Step 2: If not enough, fill with popular verses from user's favorite categories
      if (verses.length < limit && favoritedVerseIds.length > 0) {
        const favoriteVerses = await this.prisma.verse.findMany({
          where: { id: { in: favoritedVerseIds } },
          select: { categoryKeys: true },
        });

        const categoryFreq: Record<string, number> = {};
        for (const v of favoriteVerses) {
          for (const cat of v.categoryKeys) {
            categoryFreq[cat] = (categoryFreq[cat] ?? 0) + 1;
          }
        }

        const topCategories = Object.entries(categoryFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat]) => cat);

        if (topCategories.length > 0) {
          const alreadyIncluded = new Set([...favoritedVerseIds, ...verses.map((v) => v.id)]);

          const categoryVerses = await this.prisma.verse.findMany({
            where: {
              categoryKeys: { hasSome: topCategories },
              id: { notIn: [...alreadyIncluded] },
            },
            select: {
              id: true,
              verseId: true,
              sanskrit: true,
              transliteration: true,
              categoryKeys: true,
              chapterNumber: true,
              verseNumber: true,
              bookId: true,
              _count: { select: { favorites: true } },
            },
            orderBy: { favorites: { _count: 'desc' } },
            take: limit - verses.length,
          });

          verses = [...verses, ...categoryVerses];
        }
      }

      // Step 3: Fallback — globally popular verses
      if (verses.length < limit) {
        const excluded = new Set([...favoritedVerseIds, ...verses.map((v) => v.id)]);
        const popular = await this.prisma.verse.findMany({
          where: { id: { notIn: [...excluded] } },
          select: {
            id: true,
            verseId: true,
            sanskrit: true,
            transliteration: true,
            categoryKeys: true,
            chapterNumber: true,
            verseNumber: true,
            bookId: true,
            _count: { select: { favorites: true } },
          },
          orderBy: { favorites: { _count: 'desc' } },
          take: limit - verses.length,
        });
        verses = [...verses, ...popular];
      }

      return verses.slice(0, limit).map((v) => ({
        ...v,
        favoriteCount: v._count?.favorites ?? 0,
        _count: undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to get verse recommendations for user=${userId}:`, error);
      return [];
    }
  }
}
