import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { Public } from '@common/decorators/public.decorator';

@Controller('api/v1/books')
@Public()
export class BooksController {
  constructor(private booksService: BooksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllBooks(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.booksService.getAllBooks(
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
    );
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchVerses(
    @Query('q') query: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.booksService.searchVerses(
      query || '',
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
    );
  }

  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  async getBookBySlug(@Param('slug') slug: string) {
    return this.booksService.getBookBySlug(slug);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getBookById(@Param('id') bookId: string) {
    return this.booksService.getBookById(bookId);
  }

  @Get(':id/chapters')
  @HttpCode(HttpStatus.OK)
  async getChapters(@Param('id') bookId: string) {
    return this.booksService.getChapters(bookId);
  }

  @Get(':bookId/chapters/:chapterNumber')
  @HttpCode(HttpStatus.OK)
  async getChapterByNumber(
    @Param('bookId') bookId: string,
    @Param('chapterNumber') chapterNumber: string,
  ) {
    return this.booksService.getChapterByNumber(bookId, parseInt(chapterNumber, 10));
  }

  @Get(':bookId/chapters/:chapterNumber/verses/:verseNumber')
  @HttpCode(HttpStatus.OK)
  async getVerseByNumber(
    @Param('bookId') bookId: string,
    @Param('chapterNumber') chapterNumber: string,
    @Param('verseNumber') verseNumber: string,
  ) {
    return this.booksService.getVerseByNumber(
      bookId,
      parseInt(chapterNumber, 10),
      parseInt(verseNumber, 10),
    );
  }
}
