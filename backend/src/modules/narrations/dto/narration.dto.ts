export class CreateNarrationDto {
  verseId: string;
  saintNameKey: string;
  saintImageUrl?: string;
  sourceKey?: string;
  sourceYear?: number;
  narrationKey: string;
  sampradayId?: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export class UpdateNarrationDto {
  saintNameKey?: string;
  saintImageUrl?: string;
  sourceKey?: string;
  sourceYear?: number;
  narrationKey?: string;
  sampradayId?: string;
  displayOrder?: number;
  isPublished?: boolean;
}
