import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, MaxLength, IsUUID, IsBoolean } from 'class-validator';
import { PostStatus } from '@prisma/client';

export class CreatePostDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsNotEmpty()
  @IsString()
  excerpt: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  @IsOptional()
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
