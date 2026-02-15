import { Gender } from '@/common/enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @MinLength(3, { message: 'name must be at least 3 characters long' })
  @ApiPropertyOptional({ example: 'Suman Mondal' })
  name?: string;

  @IsOptional()
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Image to be uploaded',
  })
  profilePicture?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'gender must be a valid gender' })
  gender?: Gender;

  @IsOptional()
  @IsDateString({
    strict: false,
    strictSeparator: false,
  })
  dateOfBirth?: Date;
}
