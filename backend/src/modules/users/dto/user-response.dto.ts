export class UserResponseDto {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  languagePreference: string;
  onboardingCompleted: boolean;
  primarySampradayId?: string;
  isBanned: boolean;
  bannedReason?: string;
  createdAt: Date;
  lastActiveAt: Date;
}
