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
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleKey: string;

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
