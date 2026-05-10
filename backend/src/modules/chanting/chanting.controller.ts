import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChantingService } from './chanting.service';
import { LogChantDto } from './dto/log-chant.dto';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/chanting')
@UseGuards(JwtGuard)
export class ChantingController {
  constructor(private chantingService: ChantingService) {}

  @Post('log')
  @HttpCode(HttpStatus.CREATED)
  async logChant(@CurrentUser('id') userId: string, @Body() dto: LogChantDto) {
    return this.chantingService.logChant(userId, dto);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(@CurrentUser('id') userId: string) {
    return this.chantingService.getStats(userId);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('period') period: 'week' | 'month' | 'all' = 'week',
  ) {
    const data = await this.chantingService.getHistory(userId, period);
    return { data };
  }
}
