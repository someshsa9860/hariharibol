import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  sampradayId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameKey: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descriptionKey?: string;
}
