export class AppleSignInDto {
  identityToken: string;
  userIdentifier: string;
  deviceId: string;
  deviceType: string; // 'ios', 'android', 'web'
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  apnsToken?: string;
}
