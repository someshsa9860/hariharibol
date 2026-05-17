import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/recommendations')
@UseGuards(JwtGuard)
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getRecommendations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;
    const [verses, mantras] = await Promise.all([
      this.recommendationsService.getVerseRecommendations(userId, parsedLimit),
      this.recommendationsService.getMantraRecommendations(userId, parsedLimit),
    ]);
    return { verses, mantras };
  }

  @Get('verses')
  @HttpCode(HttpStatus.OK)
  async getVerseRecommendations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;
    const data = await this.recommendationsService.getVerseRecommendations(userId, parsedLimit);
    return { data };
  }

  @Get('verse-of-day/history')
  @HttpCode(HttpStatus.OK)
  async getVerseOfDayHistory(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 30) : 7;
    const data = await this.recommendationsService.getVerseOfDayHistory(parsedLimit);
    return { data };
  }
}
