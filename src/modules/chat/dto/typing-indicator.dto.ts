import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class TypingIndicatorDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @IsBoolean()
  @IsNotEmpty()
  isTyping: boolean;
}
