import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';
import { AuthModule } from '@/modules/auth/auth.module';
import { ChatModule } from '@/modules/chat/chat.module';
import { Conversation } from '@/modules/chat/entities/conversations.entity';
import { Message } from '@/modules/chat/entities/message.entity';
import { FeedModule } from '@/modules/feed/feed.module';
import { HelperModule } from '@/modules/helper/helper.module';
import { PostLike } from '@/modules/posts/entities/post-like.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { PostsModule } from '@/modules/posts/posts.module';
import { User } from '@/modules/users/entities/user.entity';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DB_URI'),
        entities: [User, Post, PostLike, Conversation, Message],
        synchronize:
          configService.getOrThrow<string>('NODE_ENV') !== 'production',
      }),
    }),
    PostsModule,
    AuthModule,
    UsersModule,
    HelperModule,
    FeedModule,
    ChatModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
