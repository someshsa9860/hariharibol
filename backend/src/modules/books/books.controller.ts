import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BooksService } from './books.service';
import { Public } from '@common/decorators/public.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';
import { ImageValidationPipe } from '@common/pipes/file-validation.pipe';
import { CreateBookDto, UpdateBookDto } from '../admin/dto/book.dto';

@ApiTags('books')
@Controller('api/v1/books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  // ── Public read endpoints ────────────────────────────────────────────────

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllBooks(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.booksService.getAllBooks(
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
      search,
    );
  }

  @Public()
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchBooks(
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

  @Public()
  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  async getBookBySlug(@Param('slug') slug: string) {
    return this.booksService.getBookBySlug(slug);
  }

  @Public()
  @Get(':id/cantos')
  @HttpCode(HttpStatus.OK)
  async getCantos(@Param('id') bookId: string) {
    return this.booksService.getCantos(bookId);
  }

  @Public()
  @Get(':id/chapters')
  @HttpCode(HttpStatus.OK)
  async getChapters(
    @Param('id') bookId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.booksService.getChapters(
      bookId,
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
    );
  }

  @Public()
  @Get(':bookId/chapters/:chapterRef/verses')
  @HttpCode(HttpStatus.OK)
  async getVersesByChapter(
    @Param('bookId') bookId: string,
    @Param('chapterRef') chapterRef: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipN = skip ? parseInt(skip, 10) : 0;
    const takeN = take ? parseInt(take, 10) : 50;
    const num = parseInt(chapterRef, 10);
    if (!isNaN(num)) {
      return this.booksService.getChapterVersesByNumber(bookId, num, skipN, takeN);
    }
    // chapterRef is a chapter ID
    const chapter = await this.booksService.getChapter(chapterRef);
    const verses = chapter.verses.slice(skipN, skipN + takeN);
    return { data: verses, total: chapter.verses.length };
  }

  @Public()
  @Get(':bookId/chapters/:chapterRef')
  @HttpCode(HttpStatus.OK)
  async getChapterDetail(
    @Param('bookId') bookId: string,
    @Param('chapterRef') chapterRef: string,
  ) {
    const num = parseInt(chapterRef, 10);
    if (!isNaN(num)) {
      return this.booksService.getChapterByNumber(bookId, num);
    }
    return this.booksService.getChapter(chapterRef);
  }

  @Public()
  @Get(':bookId/chapter-number/:chapterNumber/verses/:verseNumber')
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

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getBookById(@Param('id') bookId: string) {
    return this.booksService.getBookById(bookId);
  }

  // ── Admin write endpoints ────────────────────────────────────────────────

  @UseGuards(JwtGuard, AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBook(@Body() dto: CreateBookDto) {
    return this.booksService.adminCreateBook(dto);
  }

  @UseGuards(JwtGuard, AdminGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateBook(@Param('id') bookId: string, @Body() dto: UpdateBookDto) {
    return this.booksService.adminUpdateBook(bookId, dto);
  }

  @UseGuards(JwtGuard, AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBook(@Param('id') bookId: string) {
    return this.booksService.adminDeleteBook(bookId);
  }

  @UseGuards(JwtGuard, AdminGuard)
  @Post(':id/upload-cover')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBookCover(
    @Param('id') bookId: string,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
  ) {
    return this.booksService.uploadBookCover(
      bookId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }
}
