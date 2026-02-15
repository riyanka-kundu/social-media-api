import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'email must be a valid email' })
  @ApiProperty({ example: 'suman@gmail.com' })
  email: string;

  @IsNotEmpty({ message: 'password is required' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'password must contain at least one lowercase letter, one uppercase letter, one number, and one symbol',
    },
  )
  @ApiProperty({ example: 'Password@123' })
  password: string;

  @IsNotEmpty({ message: 'name is required' })
  @MinLength(3, { message: 'name must be at least 3 characters long' })
  @ApiProperty({ example: 'Suman Mondal' })
  name: string;
}
