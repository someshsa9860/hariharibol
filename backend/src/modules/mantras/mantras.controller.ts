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
import { MantrasService } from './mantras.service';
import { CreateMantraDto, UpdateMantraDto } from './dto/mantra.dto';
import { Public } from '@common/decorators/public.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '@common/guards/admin.guard';

@Controller('api/v1/mantras')
export class MantrasController {
  constructor(private mantrasService: MantrasService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getMantras(
    @Query('sampradayaId') sampradayaId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.mantrasService.getMantras(
      sampradayaId,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
    );
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getMantraById(@Param('id') id: string) {
    return this.mantrasService.getMantraById(id);
  }

  @Post()
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createMantra(@Body() dto: CreateMantraDto) {
    return this.mantrasService.createMantra(dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateMantra(@Param('id') id: string, @Body() dto: UpdateMantraDto) {
    return this.mantrasService.updateMantra(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async deleteMantra(@Param('id') id: string) {
    return this.mantrasService.deleteMantra(id);
  }
}
