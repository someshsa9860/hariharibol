import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { TokenService } from './token.service';
import { OAuthService } from './oauth.service';
import { GoogleSignInDto, AppleSignInDto, AuthResponseDto, AdminLoginDto } from '../dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private oauthService: OAuthService,
  ) {}

  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResponseDto> {
    // Verify Google token
    const googlePayload = await this.oauthService.verifyGoogleToken(dto.idToken);

    if (!googlePayload.email) {
      throw new BadRequestException('Google token does not contain email');
    }

    return this.handleAuthFlow(
      {
        email: googlePayload.email,
        providerUserId: googlePayload.id,
        authProvider: 'google',
        name: googlePayload.name,
        avatarUrl: googlePayload.picture,
      },
      dto.deviceId,
      dto.deviceType,
      dto.deviceModel,
      dto.osVersion,
      dto.appVersion,
      dto.fcmToken,
      null,
    );
  }

  async signInWithApple(dto: AppleSignInDto): Promise<AuthResponseDto> {
    // Verify Apple token
    const applePayload = await this.oauthService.verifyAppleToken(
      dto.identityToken,
    );

    if (!applePayload.email) {
      throw new BadRequestException(
        'Apple token does not contain email. User must have email sharing enabled.',
      );
    }

    return this.handleAuthFlow(
      {
        email: applePayload.email,
        providerUserId: applePayload.id,
        authProvider: 'apple',
        name: null,
        avatarUrl: null,
      },
      dto.deviceId,
      dto.deviceType,
      dto.deviceModel,
      dto.osVersion,
      dto.appVersion,
      null,
      dto.apnsToken,
    );
  }

  async refreshToken(refreshToken: string) {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    if (!payload || !payload.id) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if user still exists and is not banned
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user || user.isBanned) {
      throw new UnauthorizedException('User not found or banned');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await this.tokenService.generateTokens({
        id: user.id,
        email: user.email,
        deviceId: payload.deviceId,
      });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        languagePreference: user.languagePreference,
      },
    };
  }

  async logout(userId: string, deviceId: string) {
    // Update device lastSeenAt
    await this.prisma.device.update({
      where: { deviceId },
      data: { lastSeenAt: new Date() },
    });

    return { success: true };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Soft delete by marking as banned
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedReason: 'Account deleted by user',
        bannedAt: new Date(),
      },
    });

    // Also ban associated devices
    const devices = await this.prisma.device.findMany({
      where: {
        userIds: {
          hasSome: [userId],
        },
      },
    });

    for (const device of devices) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          isBanned: true,
          bannedReason: 'Associated account deleted',
          bannedAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  private async handleAuthFlow(
    profile: {
      email: string;
      providerUserId: string;
      authProvider: string;
      name?: string;
      avatarUrl?: string;
    },
    deviceId: string,
    deviceType: string,
    deviceModel?: string,
    osVersion?: string,
    appVersion?: string,
    fcmToken?: string,
    apnsToken?: string,
  ): Promise<AuthResponseDto> {
    // Check if email is banned
    const emailBan = await this.prisma.ban.findFirst({
      where: {
        type: 'email',
        value: profile.email,
        isActive: true,
      },
    });

    if (emailBan) {
      throw new UnauthorizedException(
        `Email is banned: ${emailBan.reason || 'No reason provided'}`,
      );
    }

    // Check if device is banned
    const deviceBan = await this.prisma.ban.findFirst({
      where: {
        type: 'device',
        value: deviceId,
        isActive: true,
      },
    });

    if (deviceBan) {
      throw new UnauthorizedException(
        `Device is banned: ${deviceBan.reason || 'No reason provided'}`,
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Existing user
      if (user.isBanned) {
        throw new UnauthorizedException('User account is banned');
      }

      // Check if provider matches
      if (user.authProvider !== profile.authProvider) {
        throw new ConflictException(
          `Account already exists with ${user.authProvider} provider`,
        );
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          avatarUrl: profile.avatarUrl || user.avatarUrl,
        },
      });
    } else {
      // New user
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          providerUserId: profile.providerUserId,
          authProvider: profile.authProvider,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          lastActiveAt: new Date(),
        },
      });
    }

    // Handle device
    let device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (device) {
      // Existing device
      if (device.isBanned) {
        throw new UnauthorizedException(
          `Device is banned: ${device.bannedReason || 'No reason provided'}`,
        );
      }

      // Add user to device if not already present
      if (!device.userIds.includes(user.id)) {
        device = await this.prisma.device.update({
          where: { id: device.id },
          data: {
            userIds: [...device.userIds, user.id],
            lastSeenAt: new Date(),
            fcmToken: fcmToken || device.fcmToken,
            apnsToken: apnsToken || device.apnsToken,
            appVersion: appVersion || device.appVersion,
          },
        });
      } else {
        device = await this.prisma.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            fcmToken: fcmToken || device.fcmToken,
            apnsToken: apnsToken || device.apnsToken,
            appVersion: appVersion || device.appVersion,
          },
        });
      }
    } else {
      // New device
      device = await this.prisma.device.create({
        data: {
          deviceId,
          deviceType,
          deviceModel,
          osVersion,
          appVersion,
          userIds: [user.id],
          fcmToken,
          apnsToken,
        },
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } =
      await this.tokenService.generateTokens({
        id: user.id,
        email: user.email,
        deviceId: device.deviceId,
      });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        languagePreference: user.languagePreference,
      },
    };
  }

  async adminLogin(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.tokenService.generateTokens({
      id: admin.id,
      email: admin.email,
      deviceId: 'admin-panel',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }
}
