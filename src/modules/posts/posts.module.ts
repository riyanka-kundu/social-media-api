import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PostLike } from '@/modules/posts/entities/post-like.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { PostsController } from '@/modules/posts/posts.controller';
import { PostsService } from '@/modules/posts/posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostLike])],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
