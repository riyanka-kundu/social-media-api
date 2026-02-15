import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty({ message: 'title is required' })
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 character long' })
  title: string;

  @IsNotEmpty({ message: 'body is required' })
  @IsString({ message: 'body must be a string' })
  @MinLength(10, { message: 'body must be at least 10 character long' })
  body: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Multiple files to upload (images, documents, etc.)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return value;
  })
  @IsArray({ message: 'tags must be an array' })
  @ArrayNotEmpty({ message: 'tags cannot be empty' })
  @ArrayMinSize(1, { message: 'at least 1 tag is required' })
  @IsString({ each: true, message: 'each tag must be a string' })
  tags: string[];
}
