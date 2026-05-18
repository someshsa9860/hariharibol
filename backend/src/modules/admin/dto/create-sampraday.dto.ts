import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSampradayDto {
  @ApiProperty({ example: 'vaishnavism' })
  slug: string;

  @ApiProperty({ example: 'sampraday.vaishnavism.name' })
  nameKey: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.description' })
  descriptionKey?: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.founder' })
  founderKey?: string;

  @ApiPropertyOptional({ example: 'deity.vishnu' })
  primaryDeityKey?: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.philosophy' })
  philosophyKey?: string;

  @ApiPropertyOptional({ example: 'https://example.com/hero.jpg' })
  heroImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumb.jpg' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 1400 })
  foundingYear?: number;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.region' })
  regionKey?: string;

  @ApiPropertyOptional({ example: true })
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 1 })
  displayOrder?: number;
}

export class UpdateSampradayDto {
  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.name' })
  nameKey?: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.description' })
  descriptionKey?: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.founder' })
  founderKey?: string;

  @ApiPropertyOptional({ example: 'deity.vishnu' })
  primaryDeityKey?: string;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.philosophy' })
  philosophyKey?: string;

  @ApiPropertyOptional({ example: 'https://example.com/hero.jpg' })
  heroImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumb.jpg' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 1400 })
  foundingYear?: number;

  @ApiPropertyOptional({ example: 'sampraday.vaishnavism.region' })
  regionKey?: string;

  @ApiPropertyOptional({ example: true })
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 1 })
  displayOrder?: number;
}
