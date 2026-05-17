import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { VerseOfDayService } from './verse-of-day.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';
import { Public } from '@common/decorators/public.decorator';

@Controller('api/v1/verses/of-day')
export class VerseOfDayController {
  constructor(private verseOfDayService: VerseOfDayService) {}

  @Get('')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getTodayVerse() {
    return this.verseOfDayService.getTodayVerse();
  }

  @Get('history')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getHistory(@Query('limit') limit?: number) {
    const history = await this.verseOfDayService.getVerseOfDayHistory(limit);
    return { data: history };
  }

  @Get('admin/config')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async getConfig() {
    return this.verseOfDayService.getConfig();
  }

  @Patch('admin/config')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Body() dto: { aiProvider?: 'gemini' | 'openai' | 'none'; apiKey?: string; autoGenerate?: boolean; generateImage?: boolean },
  ) {
    return this.verseOfDayService.updateConfig(dto);
  }

  @Post('admin/select/:verseId')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async selectVerse(@Param('verseId') verseId: string) {
    return this.verseOfDayService.selectVerseOfDay(verseId);
  }

  @Post('admin/generate')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateVerse() {
    return this.verseOfDayService.generateVerseOfDay();
  }

  @Post('admin/generate-image')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async regenerateImage() {
    return this.verseOfDayService.regenerateImageForToday();
  }
}
