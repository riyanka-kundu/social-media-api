import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;
}
