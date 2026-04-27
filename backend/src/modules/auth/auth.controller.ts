import {
  Controller,
  Post,
  Body,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import {
  GoogleSignInDto,
  AppleSignInDto,
  RefreshTokenDto,
  AuthResponseDto,
} from './dto';
import { JwtGuard } from './guards/jwt.guard';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  async signInWithGoogle(
    @Body() dto: GoogleSignInDto,
  ): Promise<AuthResponseDto> {
    return this.authService.signInWithGoogle(dto);
  }

  @Post('apple')
  @Public()
  @HttpCode(HttpStatus.OK)
  async signInWithApple(@Body() dto: AppleSignInDto): Promise<AuthResponseDto> {
    return this.authService.signInWithApple(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id, user.deviceId);
  }

  @Delete('account')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: any) {
    return this.authService.deleteAccount(user.id);
  }
}
