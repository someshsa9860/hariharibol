import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './services/users.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

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
}
