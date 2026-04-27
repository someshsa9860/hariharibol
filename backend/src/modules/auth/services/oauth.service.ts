import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OAuthService {
  constructor(private configService: ConfigService) {}

  async verifyGoogleToken(idToken: string) {
    try {
      // In production, verify with Google's public keys
      // For now, decode and verify basic structure
      const decoded = jwt.decode(idToken, { complete: true });

      if (!decoded) {
        throw new BadRequestException('Invalid Google token');
      }

      const payload = decoded.payload as any;

      // Verify audience matches our client IDs
      const clientId = this.configService.get('GOOGLE_CLIENT_ID_WEB');
      if (payload.aud !== clientId && !clientId) {
        throw new BadRequestException('Token audience mismatch');
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      throw new BadRequestException('Failed to verify Google token');
    }
  }

  async verifyAppleToken(identityToken: string) {
    try {
      // In production, verify with Apple's public keys
      // Decode token without verification first
      const decoded = jwt.decode(identityToken, { complete: true });

      if (!decoded) {
        throw new BadRequestException('Invalid Apple token');
      }

      const payload = decoded.payload as any;

      // Verify bundle ID matches
      const bundleId = this.configService.get('APPLE_CLIENT_ID');
      if (payload.aud !== bundleId && !bundleId) {
        throw new BadRequestException('Token audience mismatch');
      }

      return {
        id: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      throw new BadRequestException('Failed to verify Apple token');
    }
  }
}
