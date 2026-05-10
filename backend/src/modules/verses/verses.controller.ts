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

  @Get()
  @HttpCode(HttpStatus.OK)
  async listVerses(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.versesService.listVerses(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
      search,
    );
  }

  @Get('random')
  @HttpCode(HttpStatus.OK)
  async getRandomVerse(@Query('category') category?: string) {
    return this.versesService.getRandomVerse(category);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getVerseById(@Param('id') verseId: string) {
    return this.versesService.getVerseById(verseId);
  }
}
