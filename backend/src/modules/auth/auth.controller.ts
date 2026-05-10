import {
  Controller,
  Post,
  Body,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './services/auth.service';
import {
  GoogleSignInDto,
  AppleSignInDto,
  RefreshTokenDto,
  AuthResponseDto,
  AdminLoginDto,
} from './dto';
import { JwtGuard } from './guards/jwt.guard';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('admin/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.adminLogin(dto);
    res.cookie('admin_token', result.accessToken, COOKIE_OPTIONS);
    return result;
  }

  @Post('admin/logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  async adminLogout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('admin_token', { path: '/' });
    return { message: 'Logged out' };
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  async signInWithGoogle(@Body() dto: GoogleSignInDto): Promise<AuthResponseDto> {
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
