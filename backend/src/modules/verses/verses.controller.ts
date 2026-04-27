import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VersesService } from './verses.service';
import { Public } from '@common/decorators/public.decorator';

@Controller('api/v1/verses')
@Public()
export class VersesController {
  constructor(private versesService: VersesService) {}

  @Get('day')
  @HttpCode(HttpStatus.OK)
  async getVerseOfDay() {
    return this.versesService.getVerseOfDay();
  }

  @Get('random')
  @HttpCode(HttpStatus.OK)
  async getRandomVerse() {
    return this.versesService.getRandomVerse();
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchVerses(@Query('q') query: string, @Query('limit') limit = 10) {
    return this.versesService.searchVerses(query, limit);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getVerseById(@Param('id') verseId: string) {
    return this.versesService.getVerseById(verseId);
  }
}
