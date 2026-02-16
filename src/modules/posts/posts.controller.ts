import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  ValidationPipe,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CONSTANTS } from '@/common/constants';
import { LoginUser } from '@/common/decorator/login-user.decorator';
import { PostSortField, SortOrder } from '@/common/enum';
import { SingleFileInterceptor } from '@/common/interceptor/file.interceptor';
import { CreatePostDto } from '@/modules/posts/dto/create-post.dto';
import { UpdatePostDto } from '@/modules/posts/dto/update-post.dto';
import { PostsService } from '@/modules/posts/posts.service';
import { User } from '@/modules/users/entities/user.entity';

@Controller('posts')
@ApiTags('Posts')
@ApiBearerAuth()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Version('1')
  @Post()
  @UseInterceptors(SingleFileInterceptor(CONSTANTS.POST_DIR, 'images'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new post' })
  create(
    @Body(new ValidationPipe({ transform: true })) createPostDto: CreatePostDto,
    @LoginUser() user: Partial<User>,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.postsService.create(createPostDto, user, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts' })
  @Version('1')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    default: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    default: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: PostSortField,
    description: 'Sort by field',
    default: PostSortField.CREATED_AT,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SortOrder,
    description: 'Sort order',
    default: SortOrder.DESC,
  })
  findAll(
    @LoginUser() user: Partial<User>,
    @Query(
      'page',
      new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        optional: true,
      }),
    )
    page?: number,
    @Query(
      'limit',
      new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        optional: true,
      }),
    )
    limit?: number,
    @Query(
      'sortBy',
      new ParseEnumPipe(PostSortField, {
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        optional: true,
      }),
    )
    sortBy?: PostSortField,
    @Query(
      'sortOrder',
      new ParseEnumPipe(SortOrder, {
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        optional: true,
      }),
    )
    sortOrder?: SortOrder,
  ) {
    return this.postsService.findAll({
      limit: limit ?? 10,
      page: page ?? 1,
      sortBy: sortBy ?? PostSortField.CREATED_AT,
      sortOrder: sortOrder ?? SortOrder.DESC,
      user,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post' })
  @Version('1')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @LoginUser() user: Partial<User>,
  ) {
    return this.postsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @Version('1')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(SingleFileInterceptor(CONSTANTS.POST_DIR, 'images'))
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updatePostDto: UpdatePostDto,
    @LoginUser() user: Partial<User>,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.postsService.update({ id, updatePostDto, files, user });
  }

  @Version('1')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @LoginUser() user: Partial<User>,
  ) {
    return this.postsService.remove(id, user);
  }
}
