import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class MessageResponseDto {
  @Expose() id: string;
  @Expose() groupId: string;
  @Expose() userId: string;
  @Expose() content: string;
  @Expose() status: string;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
