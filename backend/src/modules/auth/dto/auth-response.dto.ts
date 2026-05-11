export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    languagePreference: string;
    onboardingCompleted: boolean;
    primarySampradayId?: string;
  };
}
