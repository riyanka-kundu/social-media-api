import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CONSTANTS } from '@/common/constants';
import { PostSortField, SortOrder } from '@/common/enum';
import { CreatePostDto } from '@/modules/posts/dto/create-post.dto';
import { UpdatePostDto } from '@/modules/posts/dto/update-post.dto';
import { PostLike } from '@/modules/posts/entities/post-like.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,

    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,

    private readonly configService: ConfigService,
  ) {}

  async create(
    createPostDto: CreatePostDto,
    user: Partial<User>,
    files?: Express.Multer.File[],
  ) {
    if (files?.length) {
      for (const file of files) {
        if (!createPostDto[file.fieldname]) {
          createPostDto[file.fieldname] = [];
        }

        createPostDto[file.fieldname].push(
          `${this.configService.getOrThrow<string>('BACKEND_URL')}/uploads/${CONSTANTS.POST_DIR}/${file.filename}`,
        );
      }
    }

    const post = await this.postsRepository.save({
      body: createPostDto.body,
      images: createPostDto.images,
      tags: createPostDto.tags,
      title: createPostDto.title,
      creator: {
        id: user.id,
      },
    });

    if (!post)
      throw new BadRequestException(
        'Failed to create a post, please try again later.',
      );

    return {
      message: 'Post created successfully!',
      data: post,
    };
  }

  async findAll({
    limit,
    page,
    sortOrder,
    sortBy,
    user,
  }: {
    page: number;
    limit: number;
    sortOrder: SortOrder;
    sortBy: PostSortField;
    user: Partial<User>;
  }) {
    const [posts, total] = await this.postsRepository.findAndCount({
      relations: ['creator'],
      where: {
        creator: { id: user.id },
      },
      order: {
        [sortBy]: sortOrder.toUpperCase() as 'ASC' | 'DESC',
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

    const postIds = posts.map((post) => post.id);
    const likedPosts = postIds.length
      ? await this.postLikeRepository.find({
          where: { user: { id: user.id }, post: { id: In(postIds) } },
          relations: ['post'],
        })
      : [];
    const likedPostIds = new Set(likedPosts.map((like) => like.post.id));

    const docsWithIsLiked = posts.map((post) => ({
      ...post,
      isLiked: likedPostIds.has(post.id),
    }));

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
          sortBy,
          sortOrder,
        },
        docs: docsWithIsLiked,
      },
    };
  }

  async findOne(id: string, user: Partial<User>) {
    const post = await this.postsRepository.findOne({
      relations: ['creator'],
      where: {
        id,
        creator: { id: user.id },
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

    const existingLike = await this.postLikeRepository.findOne({
      where: { user: { id: user.id }, post: { id } },
    });

    return {
      message: 'Post retrieved successfully!',
      data: { ...post, isLiked: !!existingLike },
    };
  }

  async update({
    id,
    updatePostDto,
    files,
    user,
  }: {
    id: string;
    updatePostDto: UpdatePostDto;
    user: Partial<User>;
    files?: Express.Multer.File[];
  }) {
    if (files?.length) {
      for (const file of files) {
        if (!updatePostDto[file.fieldname]) {
          updatePostDto[file.fieldname] = [];
        }

        updatePostDto[file.fieldname].push(
          `${this.configService.getOrThrow<string>('BACKEND_URL')}/uploads/${CONSTANTS.POST_DIR}/${file.filename}`,
        );
      }
    }
    const post = await this.postsRepository.findOne({
      relations: ['creator'],
      where: {
        id: id,
        creator: { id: user.id },
      },
    });

    if (!post) throw new BadRequestException('Post with id: %s not found!', id);

    const res = await this.postsRepository.update(
      { id },
      {
        body: updatePostDto.body ?? post.body,
        images: updatePostDto.images ?? post.images,
        tags: updatePostDto.tags ?? post.tags,
        title: updatePostDto.title ?? post.title,
      },
    );
    if (res.affected === 0)
      throw new BadRequestException(
        'Failed to update post, please try again later.',
      );

    const updatedPost = await this.postsRepository.findOne({
      relations: ['creator'],
      where: {
        id,
        creator: { id: user.id },
      },
      select: {
        creator: false,
      },
    });
    if (!updatedPost) throw new NotFoundException('Post not found!');

    return {
      message: 'Post updated successfully!',
      data: updatedPost,
    };
  }

  async remove(id: string, user: Partial<User>) {
    const postToBeDeleted = await this.postsRepository.findOne({
      relations: ['creator'],
      where: {
        id,
        creator: { id: user.id },
      },
    });

    if (!postToBeDeleted)
      throw new NotFoundException('Post with id: %s not found!', id);

    await this.postsRepository.delete({ id });
    return { message: `Post with id ${id} deleted successfully` };
  }
}
