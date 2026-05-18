import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  nameKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descriptionKey?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
