import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUser(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.mapUserToResponseDto(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatarUrl && { avatarUrl: dto.avatarUrl }),
        ...(dto.languagePreference && { languagePreference: dto.languagePreference }),
        ...(dto.primarySampradayId !== undefined && { primarySampradayId: dto.primarySampradayId }),
        lastActiveAt: new Date(),
      },
    });

    return this.mapUserToResponseDto(updatedUser);
  }

  async completeOnboarding(userId: string, sampradayId: string): Promise<UserResponseDto> {
    const sampraday = await this.prisma.sampraday.findUnique({ where: { id: sampradayId } });
    if (!sampraday) throw new BadRequestException('Sampraday not found');

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { primarySampradayId: sampradayId, onboardingCompleted: true, lastActiveAt: new Date() },
      });

      await tx.follow.upsert({
        where: { userId_sampradayId: { userId, sampradayId } },
        create: { userId, sampradayId },
        update: {},
      });

      await tx.sampraday.update({
        where: { id: sampradayId },
        data: { followerCount: { increment: 1 } },
      });

      return updated;
    });

    return this.mapUserToResponseDto(user);
  }

  private mapUserToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      languagePreference: user.languagePreference,
      onboardingCompleted: user.onboardingCompleted ?? false,
      primarySampradayId: user.primarySampradayId,
      isBanned: user.isBanned,
      bannedReason: user.bannedReason,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };
  }
}
