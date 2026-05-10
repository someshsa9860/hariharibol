import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

export interface FavoritesResult {
  verses: any[];
  mantras: any[];
}

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger('FavoritesService');

  constructor(private prisma: PrismaService) {}

  async toggleVerse(userId: string, verseId: string): Promise<{ favorited: boolean }> {
    const verse = await this.prisma.verse.findUnique({ where: { id: verseId } });
    if (!verse) throw new NotFoundException(`Verse ${verseId} not found`);

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_type_targetId: { userId, type: 'verse', targetId: verseId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      this.logger.log(`Verse unfavorited: user=${userId} verse=${verseId}`);
      return { favorited: false };
    }

    await this.prisma.favorite.create({
      data: { userId, type: 'verse', targetId: verseId },
    });
    this.logger.log(`Verse favorited: user=${userId} verse=${verseId}`);
    return { favorited: true };
  }

  async toggleMantra(userId: string, mantraId: string): Promise<{ favorited: boolean }> {
    const mantra = await this.prisma.mantra.findUnique({ where: { id: mantraId } });
    if (!mantra) throw new NotFoundException(`Mantra ${mantraId} not found`);

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_type_targetId: { userId, type: 'mantra', targetId: mantraId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      this.logger.log(`Mantra unfavorited: user=${userId} mantra=${mantraId}`);
      return { favorited: false };
    }

    await this.prisma.favorite.create({
      data: { userId, type: 'mantra', targetId: mantraId },
    });
    this.logger.log(`Mantra favorited: user=${userId} mantra=${mantraId}`);
    return { favorited: true };
  }

  async getFavorites(userId: string): Promise<FavoritesResult> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        verse: {
          select: {
            id: true,
            verseId: true,
            sanskrit: true,
            transliteration: true,
            categoryKeys: true,
            bookId: true,
            chapterNumber: true,
            verseNumber: true,
          },
        },
        mantra: {
          select: {
            id: true,
            nameKey: true,
            category: true,
            sampradayId: true,
            transliteration: true,
          },
        },
      },
    });

    const verses = favorites
      .filter((f) => f.type === 'verse' && f.verse)
      .map((f) => ({ ...f.verse, favoritedAt: f.createdAt }));

    const mantras = favorites
      .filter((f) => f.type === 'mantra' && f.mantra)
      .map((f) => ({ ...f.mantra, favoritedAt: f.createdAt }));

    return { verses, mantras };
  }
}
