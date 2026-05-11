import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { UsersService } from './services/users.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  sampradayId: string;
}

@Controller('api/v1/users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: any): Promise<UserResponseDto> {
    return this.usersService.getUser(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(user.id, dto);
  }

  @Post('me/onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentUser() user: any,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<UserResponseDto> {
    return this.usersService.completeOnboarding(user.id, dto.sampradayId);
  }
}
