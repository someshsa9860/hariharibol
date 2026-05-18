import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';

export class LogChantDto {
  @IsString()
  @IsNotEmpty()
  mantraId: string;

  @IsInt()
  @Min(1)
  count: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  durationSeconds?: number;
}

@Exclude()
export class ChantLogResponseDto {
  @Expose() id: string;
  @Expose() userId: string;
  @Expose() mantraId: string;
  @Expose() count: number;
  @Expose() durationSeconds?: number;
  @Expose() date: Date;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
