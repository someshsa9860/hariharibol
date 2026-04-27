import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VerseOfDayService } from './verse-of-day.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@Controller('api/v1/verses/of-day')
export class VerseOfDayController {
  constructor(private verseOfDayService: VerseOfDayService) {}

  @Get('')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getTodayVerse() {
    const verse = await this.verseOfDayService.getTodayVerse();
    return verse;
  }

  @Get('history')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getHistory(@Query('limit') limit?: number) {
    const history = await this.verseOfDayService.getVerseOfDayHistory(limit);
    return { data: history };
  }

  // Admin endpoints
  @Get('admin/config')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async getConfig(@CurrentUser() user: any) {
    // TODO: Verify admin role
    const config = await this.verseOfDayService.getConfig();
    return config;
  }

  @Patch('admin/config')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @CurrentUser() user: any,
    @Body() dto: {
      aiProvider?: 'gemini' | 'openai' | 'none';
      apiKey?: string;
      autoGenerate?: boolean;
      generateImage?: boolean;
    },
  ) {
    // TODO: Verify admin role
    const config = await this.verseOfDayService.updateConfig(dto);
    return config;
  }

  @Post('admin/select/:verseId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async selectVerse(
    @CurrentUser() user: any,
    @Param('verseId') verseId: string,
  ) {
    // TODO: Verify admin role
    const verseOfDay = await this.verseOfDayService.selectVerseOfDay(verseId);
    return verseOfDay;
  }

  @Post('admin/generate')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateVerse(@CurrentUser() user: any) {
    // TODO: Verify admin role
    const verseOfDay = await this.verseOfDayService.generateVerseOfDay();
    return verseOfDay;
  }

  @Post('admin/generate-image/:verseId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateImage(
    @CurrentUser() user: any,
    @Param('verseId') verseId: string,
  ) {
    // TODO: Verify admin role
    const verse = await this.verseOfDayService.selectVerseOfDay(verseId);
    return verse;
  }
}
