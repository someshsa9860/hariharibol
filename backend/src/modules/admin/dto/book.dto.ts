import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class WordMeaningDto {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  @IsNotEmpty()
  meaningKey: string;
}

export class CreateBookDto {
  @ApiProperty({ example: 'bhagavad-gita', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiProperty({ example: 'book.bhagavad_gita.title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleKey: string;

  @ApiPropertyOptional({ example: 'book.bhagavad_gita.description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descriptionKey?: string;

  @ApiPropertyOptional({ example: 'book.bhagavad_gita.author', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  authorKey?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsUrl()
  @IsOptional()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 18, minimum: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  totalChapters?: number;

  @ApiPropertyOptional({ example: 700, minimum: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  totalVerses?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateBookDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  titleKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descriptionKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  authorKey?: string;

  @IsUrl()
  @IsOptional()
  coverImageUrl?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalChapters?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalVerses?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class CreateChapterDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsInt()
  @Min(1)
  number: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleKey: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  summaryKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalVerses?: number;
}

export class UpdateChapterDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  titleKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  summaryKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalVerses?: number;
}

export class CreateVerseDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsString()
  @IsNotEmpty()
  chapterId: string;

  @IsInt()
  @Min(1)
  chapterNumber: number;

  @IsInt()
  @Min(1)
  verseNumber: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sanskrit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  transliteration?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WordMeaningDto)
  wordMeanings?: WordMeaningDto[];

  @IsString()
  @IsOptional()
  @MaxLength(200)
  translationKey?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categoryKeys?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  relatedDeityKeys?: string[];

  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @IsBoolean()
  @IsOptional()
  isVerseOfDayEligible?: boolean;
}

export class UpdateVerseDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sanskrit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  transliteration?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WordMeaningDto)
  wordMeanings?: WordMeaningDto[];

  @IsString()
  @IsOptional()
  @MaxLength(200)
  translationKey?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categoryKeys?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  relatedDeityKeys?: string[];

  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @IsBoolean()
  @IsOptional()
  isVerseOfDayEligible?: boolean;
}
