export class CreateSampradayDto {
  slug: string;
  nameKey: string;
  descriptionKey?: string;
  founderKey?: string;
  primaryDeityKey?: string;
  philosophyKey?: string;
  heroImageUrl?: string;
  thumbnailUrl?: string;
  foundingYear?: number;
  regionKey?: string;
  isPublished?: boolean;
  displayOrder?: number;
}

export class UpdateSampradayDto {
  nameKey?: string;
  descriptionKey?: string;
  founderKey?: string;
  primaryDeityKey?: string;
  philosophyKey?: string;
  heroImageUrl?: string;
  thumbnailUrl?: string;
  foundingYear?: number;
  regionKey?: string;
  isPublished?: boolean;
  displayOrder?: number;
}
