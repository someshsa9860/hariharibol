import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class GroupResponseDto {
  @Expose() id: string;
  @Expose() sampradayId: string;
  @Expose() nameKey: string;
  @Expose() descriptionKey?: string;
  @Expose() memberCount: number;
  @Expose() isActive: boolean;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
