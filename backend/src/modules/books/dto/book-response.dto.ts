import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class BookResponseDto {
  @Expose() id: string;
  @Expose() slug: string;
  @Expose() titleKey: string;
  @Expose() descriptionKey?: string;
  @Expose() authorKey?: string;
  @Expose() coverImageUrl?: string;
  @Expose() totalChapters: number;
  @Expose() totalVerses: number;
  @Expose() displayOrder: number;
  @Expose() isPublished: boolean;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}

@Exclude()
export class ChapterResponseDto {
  @Expose() id: string;
  @Expose() bookId: string;
  @Expose() number: number;
  @Expose() titleKey: string;
  @Expose() summaryKey?: string;
  @Expose() totalVerses: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}

@Exclude()
export class VerseResponseDto {
  @Expose() id: string;
  @Expose() verseId: string;
  @Expose() bookId: string;
  @Expose() chapterId: string;
  @Expose() chapterNumber: number;
  @Expose() verseNumber: number;
  @Expose() sanskrit?: string;
  @Expose() transliteration?: string;
  @Expose() wordMeanings: object[];
  @Expose() translationKey?: string;
  @Expose() categoryKeys: string[];
  @Expose() relatedDeityKeys: string[];
  @Expose() audioUrl?: string;
  @Expose() isVerseOfDayEligible: boolean;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
