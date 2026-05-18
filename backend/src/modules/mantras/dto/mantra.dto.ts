import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { Exclude, Expose } from 'class-transformer';

export class CreateMantraDto {
  @IsString()
  @IsNotEmpty()
  sampradayId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameKey: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sanskrit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  transliteration?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  meaningKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  significanceKey?: string;

  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  recommendedCount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  relatedDeityKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}

export class UpdateMantraDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  nameKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sanskrit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  transliteration?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  meaningKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  significanceKey?: string;

  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  recommendedCount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  relatedDeityKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}

@Exclude()
export class MantraResponseDto {
  @Expose() id: string;
  @Expose() sampradayId: string;
  @Expose() nameKey: string;
  @Expose() sanskrit?: string;
  @Expose() transliteration?: string;
  @Expose() meaningKey?: string;
  @Expose() significanceKey?: string;
  @Expose() audioUrl?: string;
  @Expose() isPublic: boolean;
  @Expose() recommendedCount: number;
  @Expose() category?: string;
  @Expose() relatedDeityKey?: string;
  @Expose() displayOrder: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
