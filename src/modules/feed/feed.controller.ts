import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { LoginUser } from '@/common/decorator/login-user.decorator';
import { User } from '@/modules/users/entities/user.entity';
import { FeedService } from './feed.service';

@Controller('feed')
@ApiTags('Feed')
@ApiBearerAuth()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get post feed' })
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
  findAll(
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
  ) {
    return this.feedService.getFeed({ page: page ?? 1, limit: limit ?? 10 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post' })
  @Version('1')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.feedService.findOne(id);
  }

  @Patch(':id/like')
  @ApiOperation({ summary: 'Toggle like on a post' })
  @Version('1')
  likePost(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @LoginUser() user: User,
  ) {
    return this.feedService.toggleLikePost(id, user.id);
  }
}
