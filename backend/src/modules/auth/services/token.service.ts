import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  async generateTokens(payload: {
    id: string;
    email: string;
    deviceId: string;
    isAdmin?: boolean;
  }) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY') || '15m',
    });

    const refreshExpiryDays = 30;
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY') || '30d',
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiryDays);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: payload.isAdmin ? null : payload.id,
        adminId: payload.isAdmin ? payload.id : null,
        deviceId: payload.deviceId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, refreshTokenHash: tokenHash };
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
  }

  async verifyAccessToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
    });
  }

  async consumeRefreshToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      return false;
    }

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    return true;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  validateTokenHash(token: string, hash: string): boolean {
    return this.hashToken(token) === hash;
  }
}
