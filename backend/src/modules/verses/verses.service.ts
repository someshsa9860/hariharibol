import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class VersesService {
  constructor(private prisma: PrismaService) {}

  async getVerseById(verseId: string) {
    const verse = await this.prisma.verse.findUnique({
      where: { id: verseId },
      include: {
        narrations: { where: { isPublished: true }, take: 5 },
        verseRelations: { include: { sampraday: true }, take: 3 },
        book: true,
        chapter: true,
      },
    });

    if (!verse) {
      throw new BadRequestException('Verse not found');
    }

    return verse;
  }

  async getVerseOfDay() {
    const verse = await this.prisma.verse.findFirst({
      where: { isVerseOfDayEligible: true },
      orderBy: { createdAt: 'desc' },
      include: {
        narrations: { where: { isPublished: true }, take: 3 },
        book: true,
        chapter: true,
        verseRelations: { include: { sampraday: true } },
      },
    });

    return verse || this.getRandomVerse();
  }

  async getRandomVerse() {
    const verses = await this.prisma.verse.findMany({
      take: 1,
      skip: Math.floor(Math.random() * 1000),
      include: {
        narrations: { where: { isPublished: true }, take: 3 },
        book: true,
        chapter: true,
      },
    });

    return verses[0] || null;
  }

  async getVersesByBook(bookId: string, skip?: number, take?: number) {
    const [verses, total] = await Promise.all([
      this.prisma.verse.findMany({
        where: { bookId },
        skip,
        take,
        include: { chapter: true },
        orderBy: { chapterNumber: 'asc' },
      }),
      this.prisma.verse.count({ where: { bookId } }),
    ]);

    return {
      data: verses,
      total,
      skip: skip || 0,
      take: take || total,
    };
  }

  async getVersesByChapter(chapterId: string) {
    return this.prisma.verse.findMany({
      where: { chapterId },
      include: { chapter: true, narrations: { take: 2 } },
      orderBy: { verseNumber: 'asc' },
    });
  }

  async searchVerses(query: string, limit = 10) {
    return this.prisma.verse.findMany({
      where: {
        OR: [
          {
            transliteration: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            sanskrit: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: { book: true, chapter: true },
      take: limit,
    });
  }
}
