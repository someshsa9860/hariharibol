import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name?: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  languagePreference: string;

  @Expose()
  onboardingCompleted: boolean;

  @Expose()
  primarySampradayId?: string;

  @Expose()
  isBanned: boolean;

  @Expose()
  bannedReason?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  lastActiveAt: Date;
}
