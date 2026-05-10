export class CreateMantraDto {
  sampradayId: string;
  nameKey: string;
  sanskrit?: string;
  transliteration?: string;
  meaningKey?: string;
  significanceKey?: string;
  audioUrl?: string;
  isPublic?: boolean;
  recommendedCount?: number;
  category?: string;
  relatedDeityKey?: string;
  displayOrder?: number;
}

export class UpdateMantraDto {
  nameKey?: string;
  sanskrit?: string;
  transliteration?: string;
  meaningKey?: string;
  significanceKey?: string;
  audioUrl?: string;
  isPublic?: boolean;
  recommendedCount?: number;
  category?: string;
  relatedDeityKey?: string;
  displayOrder?: number;
}
