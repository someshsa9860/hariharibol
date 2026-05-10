import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/favorites')
@UseGuards(JwtGuard)
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post('verses/:verseId')
  @HttpCode(HttpStatus.OK)
  async toggleVerse(
    @CurrentUser('id') userId: string,
    @Param('verseId') verseId: string,
  ) {
    return this.favoritesService.toggleVerse(userId, verseId);
  }

  @Post('mantras/:mantraId')
  @HttpCode(HttpStatus.OK)
  async toggleMantra(
    @CurrentUser('id') userId: string,
    @Param('mantraId') mantraId: string,
  ) {
    return this.favoritesService.toggleMantra(userId, mantraId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getFavorites(@CurrentUser('id') userId: string) {
    return this.favoritesService.getFavorites(userId);
  }
}
