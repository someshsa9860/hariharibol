import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SampradayasService } from './sampradayas.service';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

@Controller('api/v1/sampradayas')
export class SampradayasController {
  constructor(private sampradayasService: SampradayasService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getAllSampradayas(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.sampradayasService.getAllSampradayas(skip, take);
  }

  @Get(':slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getSampradayBySlug(@Param('slug') slug: string) {
    return this.sampradayasService.getSampradayBySlug(slug);
  }

  @Post(':id/follow')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async followSampraday(
    @CurrentUser() user: any,
    @Param('id') sampradayId: string,
  ) {
    return this.sampradayasService.followSampraday(user.id, sampradayId);
  }

  @Delete(':id/follow')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async unfollowSampraday(
    @CurrentUser() user: any,
    @Param('id') sampradayId: string,
  ) {
    return this.sampradayasService.unfollowSampraday(user.id, sampradayId);
  }

  @Get('me/followed')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async getFollowedSampradayas(@CurrentUser() user: any) {
    return this.sampradayasService.getUserFollowedSampradayas(user.id);
  }
}
