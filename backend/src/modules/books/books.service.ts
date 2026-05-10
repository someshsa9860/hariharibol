import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateBookDto, UpdateBookDto, CreateChapterDto, UpdateChapterDto, CreateVerseDto, UpdateVerseDto } from '../admin/dto/book.dto';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  // ── Public read methods ──────────────────────────────────────────────────

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

    return { data: books, total, skip: skip || 0, take: take || total };
  }

  async getBookById(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: { orderBy: { number: 'asc' } },
        _count: { select: { chapters: true, verses: true } },
      },
    });

    if (!book) throw new BadRequestException('Book not found');
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

    if (!book) throw new BadRequestException('Book not found');
    return book;
  }

  async getChapters(bookId: string) {
    return this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
      include: { _count: { select: { verses: true } } },
    });
  }

  async getChapter(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        book: true,
        verses: { orderBy: { verseNumber: 'asc' } },
        _count: { select: { verses: true } },
      },
    });

    if (!chapter) throw new BadRequestException('Chapter not found');
    return chapter;
  }

  // ── Admin: Book CRUD ─────────────────────────────────────────────────────

  async adminGetAllBooks(skip = 0, take = 50) {
    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        skip,
        take,
        include: { _count: { select: { chapters: true, verses: true } } },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.book.count(),
    ]);

    return { data: books, total };
  }

  async adminCreateBook(dto: CreateBookDto) {
    const existing = await this.prisma.book.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('A book with this slug already exists');

    return this.prisma.book.create({
      data: {
        slug: dto.slug,
        titleKey: dto.titleKey,
        descriptionKey: dto.descriptionKey,
        authorKey: dto.authorKey,
        coverImageUrl: dto.coverImageUrl,
        totalChapters: dto.totalChapters || 0,
        totalVerses: dto.totalVerses || 0,
        displayOrder: dto.displayOrder || 0,
        isPublished: dto.isPublished || false,
      },
    });
  }

  async adminUpdateBook(bookId: string, dto: UpdateBookDto) {
    await this._assertBookExists(bookId);
    return this.prisma.book.update({ where: { id: bookId }, data: dto });
  }

  async adminDeleteBook(bookId: string) {
    await this._assertBookExists(bookId);
    return this.prisma.book.delete({ where: { id: bookId } });
  }

  // ── Admin: Chapter CRUD ──────────────────────────────────────────────────

  async adminGetChapters(bookId: string) {
    await this._assertBookExists(bookId);
    return this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
      include: { _count: { select: { verses: true } } },
    });
  }

  async adminCreateChapter(dto: CreateChapterDto) {
    await this._assertBookExists(dto.bookId);

    const existing = await this.prisma.chapter.findUnique({
      where: { bookId_number: { bookId: dto.bookId, number: dto.number } },
    });
    if (existing) throw new BadRequestException(`Chapter ${dto.number} already exists in this book`);

    return this.prisma.chapter.create({
      data: {
        bookId: dto.bookId,
        number: dto.number,
        titleKey: dto.titleKey,
        summaryKey: dto.summaryKey,
        totalVerses: dto.totalVerses || 0,
      },
    });
  }

  async adminUpdateChapter(chapterId: string, dto: UpdateChapterDto) {
    await this._assertChapterExists(chapterId);
    return this.prisma.chapter.update({ where: { id: chapterId }, data: dto });
  }

  async adminDeleteChapter(chapterId: string) {
    await this._assertChapterExists(chapterId);
    return this.prisma.chapter.delete({ where: { id: chapterId } });
  }

  // ── Admin: Verse CRUD ────────────────────────────────────────────────────

  async adminGetVerses(chapterId: string) {
    await this._assertChapterExists(chapterId);
    return this.prisma.verse.findMany({
      where: { chapterId },
      orderBy: { verseNumber: 'asc' },
    });
  }

  async adminCreateVerse(dto: CreateVerseDto) {
    await this._assertChapterExists(dto.chapterId);

    const existing = await this.prisma.verse.findUnique({
      where: {
        bookId_chapterNumber_verseNumber: {
          bookId: dto.bookId,
          chapterNumber: dto.chapterNumber,
          verseNumber: dto.verseNumber,
        },
      },
    });
    if (existing) throw new BadRequestException(`Verse ${dto.chapterNumber}.${dto.verseNumber} already exists`);

    return this.prisma.verse.create({
      data: {
        bookId: dto.bookId,
        chapterId: dto.chapterId,
        chapterNumber: dto.chapterNumber,
        verseNumber: dto.verseNumber,
        sanskrit: dto.sanskrit,
        transliteration: dto.transliteration,
        wordMeanings: dto.wordMeanings || [],
        translationKey: dto.translationKey,
        categoryKeys: dto.categoryKeys || [],
        relatedDeityKeys: dto.relatedDeityKeys || [],
        audioUrl: dto.audioUrl,
        isVerseOfDayEligible: dto.isVerseOfDayEligible || false,
      },
    });
  }

  async adminUpdateVerse(verseId: string, dto: UpdateVerseDto) {
    const verse = await this.prisma.verse.findUnique({ where: { id: verseId } });
    if (!verse) throw new NotFoundException('Verse not found');
    return this.prisma.verse.update({ where: { id: verseId }, data: dto });
  }

  async adminDeleteVerse(verseId: string) {
    const verse = await this.prisma.verse.findUnique({ where: { id: verseId } });
    if (!verse) throw new NotFoundException('Verse not found');
    return this.prisma.verse.delete({ where: { id: verseId } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async _assertBookExists(bookId: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  private async _assertChapterExists(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }
}
