import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { VersesService } from './verses.service';
import { Public } from '@common/decorators/public.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

@Controller('api/v1/verses')
export class VersesController {
  constructor(private versesService: VersesService) {}

  @Public()
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

  @Public()
  @Get('random')
  @HttpCode(HttpStatus.OK)
  async getRandomVerse(@Query('category') category?: string) {
    return this.versesService.getRandomVerse(category);
  }

  @Public()
  @Get(':id/narrations')
  @HttpCode(HttpStatus.OK)
  async getVerseNarrations(@Param('id') verseId: string) {
    return this.versesService.getVerseNarrations(verseId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async toggleFavorite(@Param('id') verseId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.versesService.toggleFavorite(user.sub || user.id, verseId);
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getVerseById(@Param('id') verseId: string) {
    return this.versesService.getVerseById(verseId);
  }
}
