import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Exclude, Expose } from 'class-transformer';

export class CreateNarrationDto {
  @IsString()
  @IsNotEmpty()
  verseId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  saintNameKey: string;

  @IsUrl()
  @IsOptional()
  saintImageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  sourceKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sourceYear?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  narrationKey: string;

  @IsString()
  @IsOptional()
  sampradayId?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateNarrationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  saintNameKey?: string;

  @IsUrl()
  @IsOptional()
  saintImageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  sourceKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sourceYear?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  narrationKey?: string;

  @IsString()
  @IsOptional()
  sampradayId?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

@Exclude()
export class NarrationResponseDto {
  @Expose() id: string;
  @Expose() verseId: string;
  @Expose() saintNameKey: string;
  @Expose() saintImageUrl?: string;
  @Expose() sourceKey?: string;
  @Expose() sourceYear?: number;
  @Expose() narrationKey: string;
  @Expose() sampradayId?: string;
  @Expose() displayOrder: number;
  @Expose() isPublished: boolean;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
