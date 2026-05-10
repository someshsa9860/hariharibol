import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NarrationsService } from './narrations.service';
import { CreateNarrationDto, UpdateNarrationDto } from './dto/narration.dto';
import { Public } from '@common/decorators/public.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';

@Controller('api/v1/narrations')
export class NarrationsController {
  constructor(private narrationsService: NarrationsService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getNarrations(
    @Query('verseId') verseId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.narrationsService.getNarrations(
      verseId,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
    );
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getNarrationById(@Param('id') id: string) {
    return this.narrationsService.getNarrationById(id);
  }

  @Post()
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createNarration(@Body() dto: CreateNarrationDto) {
    return this.narrationsService.createNarration(dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateNarration(@Param('id') id: string, @Body() dto: UpdateNarrationDto) {
    return this.narrationsService.updateNarration(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async deleteNarration(@Param('id') id: string) {
    return this.narrationsService.deleteNarration(id);
  }
}
