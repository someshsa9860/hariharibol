export class CreateBookDto {
  slug: string;
  titleKey: string;
  descriptionKey?: string;
  authorKey?: string;
  coverImageUrl?: string;
  totalChapters?: number;
  totalVerses?: number;
  displayOrder?: number;
  isPublished?: boolean;
}

export class UpdateBookDto {
  titleKey?: string;
  descriptionKey?: string;
  authorKey?: string;
  coverImageUrl?: string;
  totalChapters?: number;
  totalVerses?: number;
  displayOrder?: number;
  isPublished?: boolean;
}

export class CreateChapterDto {
  bookId: string;
  number: number;
  titleKey: string;
  summaryKey?: string;
  totalVerses?: number;
}

export class UpdateChapterDto {
  titleKey?: string;
  summaryKey?: string;
  totalVerses?: number;
}

export class CreateVerseDto {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  verseNumber: number;
  sanskrit?: string;
  transliteration?: string;
  wordMeanings?: { word: string; meaningKey: string }[];
  translationKey?: string;
  categoryKeys?: string[];
  relatedDeityKeys?: string[];
  audioUrl?: string;
  isVerseOfDayEligible?: boolean;
}

export class UpdateVerseDto {
  sanskrit?: string;
  transliteration?: string;
  wordMeanings?: { word: string; meaningKey: string }[];
  translationKey?: string;
  categoryKeys?: string[];
  relatedDeityKeys?: string[];
  audioUrl?: string;
  isVerseOfDayEligible?: boolean;
}
