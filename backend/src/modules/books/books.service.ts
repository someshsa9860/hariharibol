import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async getAllBooks(skip?: number, take?: number) {
    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where: { isPublished: true },
        skip,
        take,
        include: {
          _count: { select: { chapters: true, verses: true } },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.book.count({ where: { isPublished: true } }),
    ]);

    return {
      data: books,
      total,
      skip: skip || 0,
      take: take || total,
    };
  }

  async getBookById(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: { orderBy: { number: 'asc' } },
        _count: { select: { chapters: true, verses: true } },
      },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    return book;
  }

  async getBookBySlug(slug: string) {
    const book = await this.prisma.book.findUnique({
      where: { slug },
      include: {
        chapters: { orderBy: { number: 'asc' } },
        _count: { select: { chapters: true, verses: true } },
      },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    return book;
  }

  async getChapters(bookId: string) {
    return this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
      include: {
        _count: { select: { verses: true } },
      },
    });
  }

  async getChapter(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        book: true,
        verses: {
          orderBy: { verseNumber: 'asc' },
        },
        _count: { select: { verses: true } },
      },
    });

    if (!chapter) {
      throw new BadRequestException('Chapter not found');
    }

    return chapter;
  }
}
