import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/recommendations')
@UseGuards(JwtGuard)
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @Get('verses')
  @HttpCode(HttpStatus.OK)
  async getVerseRecommendations(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;
    const data = await this.recommendationsService.getVerseRecommendations(userId, parsedLimit);
    return { data };
  }
}
