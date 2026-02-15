import {
  Body,
  Controller,
  Get,
  HttpStatus,
  ParseIntPipe,
  Patch,
  Query,
  UploadedFiles,
  UseInterceptors,
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
import { SingleFileInterceptor } from '@/common/interceptor/file.interceptor';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get all users' })
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
  ) {
    return this.usersService.findAllUsers({
      page: page ?? 1,
      limit: limit ?? 10,
      user,
    });
  }

  @Version('1')
  @Get('my-profile')
  @ApiOperation({ summary: 'Get my profile' })
  profile(@LoginUser() user: Partial<User>) {
    return this.usersService.getProfile(user);
  }

  @Version('1')
  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    SingleFileInterceptor(CONSTANTS.PROFILE_PICTURE_DIR, 'profilePicture'),
  )
  updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @LoginUser() user: Partial<User>,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.usersService.updateProfile({ updateUserDto, user, files });
  }
}
