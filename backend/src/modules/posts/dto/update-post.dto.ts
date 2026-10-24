import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  IsUUID,
  IsBoolean,
  IsISO8601,
  ValidateIf,
} from 'class-validator';
import { PostStatus } from '@prisma/client';

export class UpdatePostDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(150)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(180)
  slug?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  excerpt?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoDescription?: string;
}
