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
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.booksService.getAllBooks(skip, take);
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

  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  async getBookBySlug(@Param('slug') slug: string) {
    return this.booksService.getBookBySlug(slug);
  }
}
