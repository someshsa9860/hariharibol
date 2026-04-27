import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateTokens(payload: { id: string; email: string; deviceId: string }) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY') || '30d',
    });

    // Hash refresh token for storage
    const refreshTokenHash = this.hashToken(refreshToken);

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
    };
  }

  async verifyAccessToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
    });
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  validateTokenHash(token: string, hash: string): boolean {
    return this.hashToken(token) === hash;
  }
}
