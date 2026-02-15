import { CONSTANTS } from '@/common/constants';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { User } from '@/modules/users/entities/user.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}
  async getProfile(user: Partial<User>) {
    const currentUser = await this.userRepository.findOne({
      where: {
        id: user.id,
      },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'updatedAt',
      ],
    });
    if (!currentUser) throw new NotFoundException('User not found!');
    return {
      message: 'Profile retrieved successfully!',
      data: {
        user: currentUser,
      },
    };
  }

  async updateProfile({
    updateUserDto,
    user,
    files,
  }: {
    updateUserDto: UpdateUserDto;
    user: Partial<User>;
    files?: Express.Multer.File[];
  }) {
    if (files?.length) {
      for (const file of files) {
        if (!updateUserDto[file.fieldname]) {
          updateUserDto[file.fieldname] = '';
        }

        updateUserDto[file.fieldname] =
          `${this.configService.getOrThrow<string>('BACKEND_URL')}/uploads/${CONSTANTS.PROFILE_PICTURE_DIR}/${file.filename}`;
      }
    }

    const currentUser = await this.userRepository.findOne({
      where: {
        id: user.id,
      },
    });

    if (!currentUser) throw new NotFoundException('User not found!');

    const res = await this.userRepository.update(
      { id: user.id },
      {
        name: updateUserDto.name ?? currentUser.name,
        profilePicture:
          updateUserDto.profilePicture ?? currentUser.profilePicture,
        gender: updateUserDto.gender ?? currentUser.gender,
        dateOfBirth: updateUserDto.dateOfBirth ?? currentUser.dateOfBirth,
      },
    );

    if (res.affected === 0)
      throw new NotFoundException('Failed to update user!');

    const updatedUser = await this.userRepository.findOne({
      where: {
        id: user.id,
      },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'updatedAt',
      ],
    });

    if (!updatedUser) throw new NotFoundException('Failed to update user!');

    return {
      message: 'User updated successfully!',
      data: updatedUser,
    };
  }

  async findAllUsers({
    limit,
    page,
    user,
  }: {
    page: number;
    limit: number;
    user: Partial<User>;
  }) {
    const where: any = {};

    if (user.id) {
      where.id = Not(user.id);
    }
    const [users, total] = await this.userRepository.findAndCount({
      where,
      order: {
        name: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        profilePicture: true,
        gender: true,
      },
    });

    return {
      message: 'Users retrieved successfully!',
      data: {
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        docs: users,
      },
    };
  }
}
