import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';

@Controller('api/v1/admin/analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(@Query('period') period: 'day' | 'week' | 'month' = 'month') {
    return this.analyticsService.getMetrics(period);
  }

  @Get('dau')
  @HttpCode(HttpStatus.OK)
  async getDau(@Query('days') days?: string) {
    const data = await this.analyticsService.getDau(days ? parseInt(days, 10) : 30);
    return { data };
  }

  @Get('top-verses')
  @HttpCode(HttpStatus.OK)
  async getTopVerses(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getTopVerses(limit ? parseInt(limit, 10) : 5);
    return { data };
  }

  @Get('top-sampradayas')
  @HttpCode(HttpStatus.OK)
  async getTopSampradayas(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getTopSampradayas(limit ? parseInt(limit, 10) : 5);
    return { data };
  }

  @Get('chants')
  @HttpCode(HttpStatus.OK)
  async getDailyChants(@Query('days') days?: string) {
    const data = await this.analyticsService.getDailyChants(days ? parseInt(days, 10) : 14);
    return { data };
  }

  @Get('top-mantras')
  @HttpCode(HttpStatus.OK)
  async getTopMantras(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getTopMantras(limit ? parseInt(limit, 10) : 5);
    return { data };
  }

  @Get('user-growth')
  @HttpCode(HttpStatus.OK)
  async getUserGrowth(@Query('days') days?: string) {
    const data = await this.analyticsService.getUserGrowth(days ? parseInt(days, 10) : 30);
    return { data };
  }

  @Get('engagement')
  @HttpCode(HttpStatus.OK)
  async getEngagementMetrics() {
    return this.analyticsService.getEngagementMetrics();
  }

  @Get('top-content')
  @HttpCode(HttpStatus.OK)
  async getTopContent(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getTopContent(limit ? parseInt(limit, 10) : 10);
    return { data };
  }

  @Get('banned-users')
  @HttpCode(HttpStatus.OK)
  async getBannedUsersCount() {
    const count = await this.analyticsService.getBannedUsersCount();
    return { count };
  }
}
