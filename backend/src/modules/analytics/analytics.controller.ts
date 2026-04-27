import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
  ) {
    // TODO: Verify admin role
    const metrics = await this.analyticsService.getMetrics(period);
    return metrics;
  }

  @Get('user-growth')
  @HttpCode(HttpStatus.OK)
  async getUserGrowth(
    @CurrentUser() user: any,
    @Query('days') days?: number,
  ) {
    // TODO: Verify admin role
    const data = await this.analyticsService.getUserGrowth(days || 30);
    return { data };
  }

  @Get('engagement')
  @HttpCode(HttpStatus.OK)
  async getEngagementMetrics(@CurrentUser() user: any) {
    // TODO: Verify admin role
    const metrics = await this.analyticsService.getEngagementMetrics();
    return metrics;
  }

  @Get('top-content')
  @HttpCode(HttpStatus.OK)
  async getTopContent(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    // TODO: Verify admin role
    const content = await this.analyticsService.getTopContent(limit || 10);
    return { data: content };
  }

  @Get('banned-users')
  @HttpCode(HttpStatus.OK)
  async getBannedUsersCount(@CurrentUser() user: any) {
    // TODO: Verify admin role
    const count = await this.analyticsService.getBannedUsersCount();
    return { count };
  }
}
