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

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatarUrl && { avatarUrl: dto.avatarUrl }),
        ...(dto.languagePreference && {
          languagePreference: dto.languagePreference,
        }),
        lastActiveAt: new Date(),
      },
    });

    return this.mapUserToResponseDto(updatedUser);
  }

  private mapUserToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      languagePreference: user.languagePreference,
      isBanned: user.isBanned,
      bannedReason: user.bannedReason,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };
  }
}
