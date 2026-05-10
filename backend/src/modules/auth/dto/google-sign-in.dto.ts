import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  deviceType: string;

  @IsString()
  @IsOptional()
  deviceModel?: string;

  @IsString()
  @IsOptional()
  osVersion?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}
