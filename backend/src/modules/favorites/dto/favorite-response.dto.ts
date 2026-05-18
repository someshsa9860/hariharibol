import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class FavoriteVerseResponseDto {
  @Expose() id: string;
  @Expose() verseId: string;
  @Expose() sanskrit?: string;
  @Expose() transliteration?: string;
  @Expose() categoryKeys: string[];
  @Expose() bookId: string;
  @Expose() chapterNumber: number;
  @Expose() verseNumber: number;
  @Expose() favoritedAt: Date;
}

@Exclude()
export class FavoriteMantraResponseDto {
  @Expose() id: string;
  @Expose() nameKey: string;
  @Expose() category?: string;
  @Expose() sampradayId: string;
  @Expose() transliteration?: string;
  @Expose() favoritedAt: Date;
}

export class FavoritesResponseDto {
  verses: FavoriteVerseResponseDto[];
  mantras: FavoriteMantraResponseDto[];
}
