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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export class CreateMantraDto {
  @ApiProperty({ example: 'clx1234abc' })
  @IsString()
  @IsNotEmpty()
  sampradayId: string;

  @ApiProperty({ example: 'mantra.om_namah_shivaya.name', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameKey: string;

  @ApiPropertyOptional({ example: 'ॐ नमः शिवाय', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sanskrit?: string;

  @ApiPropertyOptional({ example: 'Om Namah Shivaya', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  transliteration?: string;

  @ApiPropertyOptional({ example: 'mantra.om_namah_shivaya.meaning', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  meaningKey?: string;

  @ApiPropertyOptional({ example: 'mantra.om_namah_shivaya.significance', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  significanceKey?: string;

  @ApiPropertyOptional({ example: 'https://example.com/mantra.mp3' })
  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 108, minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  recommendedCount?: number;

  @ApiPropertyOptional({ example: 'shaiva', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'deity.shiva', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  relatedDeityKey?: string;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
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
