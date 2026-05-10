import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class AppleSignInDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @IsString()
  @IsNotEmpty()
  userIdentifier: string;

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
  apnsToken?: string;
}
