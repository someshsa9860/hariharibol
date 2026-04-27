export class GoogleSignInDto {
  idToken: string;
  deviceId: string;
  deviceType: string; // 'ios', 'android', 'web'
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  fcmToken?: string;
}
