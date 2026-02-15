import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/modules/auth/auth.module';
import { ChatGateway } from '@/modules/chat/chat.gateway';
import { ChatService } from '@/modules/chat/chat.service';
import { Conversation } from '@/modules/chat/entities/conversations.entity';
import { Message } from '@/modules/chat/entities/message.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Conversation, Message, User]),
    UsersModule,
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
