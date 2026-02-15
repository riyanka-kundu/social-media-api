import { PostLike } from '@/modules/posts/entities/post-like.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
  ) {}

  async getFeed({ page, limit }: { page: number; limit: number }) {
    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['creator'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        creator: {
          name: true,
          profilePicture: true,
          id: true,
        },
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Posts retrieved successfully!',
      data: {
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        docs: posts,
      },
    };
  }

  async findOne(id: string) {
    const post = await this.postRepository.findOne({
      relations: ['creator'],
      where: {
        id,
      },
      select: {
        creator: {
          name: true,
          profilePicture: true,
          id: true,
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found!');

    return {
      message: 'Post retrieved successfully!',
      data: post,
    };
  }

  async toggleLikePost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with id ${postId} not found!`);

    const existingLike = await this.postLikeRepository.findOne({
      where: { user: { id: userId }, post: { id: postId } },
    });

    let isLiked: boolean;

    if (existingLike) {
      await this.postLikeRepository.remove(existingLike);
      await this.postRepository.decrement({ id: postId }, 'likeCount', 1);
      isLiked = false;
    } else {
      const like = this.postLikeRepository.create({
        user: { id: userId },
        post: { id: postId },
      });
      await this.postLikeRepository.save(like);
      await this.postRepository.increment({ id: postId }, 'likeCount', 1);
      isLiked = true;
    }

    const updatedPost = await this.postRepository.findOne({
      relations: ['creator'],
      where: { id: postId },
      select: {
        creator: {
          name: true,
          profilePicture: true,
          id: true,
        },
      },
    });

    return {
      message: isLiked
        ? 'Post liked successfully!'
        : 'Post unlike successfully!',
      data: { ...updatedPost, isLiked },
    };
  }
}
