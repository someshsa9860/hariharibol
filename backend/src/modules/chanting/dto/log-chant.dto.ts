import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class LogChantDto {
  @IsString()
  mantraId: string;

  @IsInt()
  @Min(1)
  count: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  durationSeconds?: number;
}
