import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostStatus } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  // Text slugifier utility
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')     // Remove non-word chars
      .replace(/[\s_-]+/g, '-')      // Replace spaces/hyphens with single hyphen
      .replace(/^-+|-+$/g, '');      // Trim hyphens
  }

  // Generates a unique slug by appending counters if collisions are detected
  private async generateUniqueSlug(title: string, customSlug?: string, excludePostId?: string): Promise<string> {
    const baseSlug = this.slugify(customSlug && customSlug.trim() !== '' ? customSlug : title);
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.post.findUnique({
        where: { slug: uniqueSlug },
      });

      // Break if no collision, or if the collision is the post itself we are updating
      if (!existing || (excludePostId && existing.id === excludePostId)) {
        break;
      }

      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  // Create Post
  async create(dto: CreatePostDto) {
    const postTitle = dto.title?.trim() !== '' ? (dto.title?.trim() || 'Untitled Draft') : 'Untitled Draft';
    const slug = await this.generateUniqueSlug(postTitle, dto.slug);

    // Verify category if categoryId is provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    // Verify tag existence if tags are provided
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tagCount = await this.prisma.tag.count({
        where: { id: { in: dto.tagIds } },
      });
      if (tagCount !== dto.tagIds.length) {
        throw new NotFoundException('One or more tag IDs do not exist in the database');
      }
    }

    return this.prisma.post.create({
      data: {
        title: postTitle,
        slug,
        excerpt: (dto.excerpt || '').trim(),
        content: dto.content || '',
        featuredImage: dto.featuredImage || null,
        status: dto.status || PostStatus.DRAFT,
        featured: dto.featured ?? false,
        categoryId: dto.categoryId || null,
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
        tags: {
          create: dto.tagIds?.map((tagId) => ({ tagId })) || [],
        },
      },
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
      },
    });
  }

  // Find all posts with dynamic filters (status, category, tags, search)
  async findAll(filters: {
    status?: PostStatus;
    categoryId?: string;
    tagId?: string;
    q?: string;
    featured?: boolean;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.featured !== undefined) {
      where.featured = filters.featured;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.tagId) {
      where.tags = {
        some: { tagId: filters.tagId },
      };
    }

    if (filters.q) {
      const search = filters.q.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.post.findMany({
      where,
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Find one by ID or Slug
  async findOne(idOrSlug: string, onlyPublished = false) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const post = await this.prisma.post.findUnique({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID or slug '${idOrSlug}' not found`);
    }

    if (onlyPublished && post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException(`Post not available`);
    }

    return post;
  }

  // Update Post
  async update(id: string, dto: UpdatePostDto) {
    const post = await this.findOne(id);

    let slug = post.slug;
    if (dto.title || dto.slug) {
      slug = await this.generateUniqueSlug(dto.title || post.title, dto.slug, id);
    }

    // Verify category if changing categoryId
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    // Verify tag existence if tags are being updated
    if (dto.tagIds) {
      if (dto.tagIds.length > 0) {
        const tagCount = await this.prisma.tag.count({
          where: { id: { in: dto.tagIds } },
        });
        if (tagCount !== dto.tagIds.length) {
          throw new NotFoundException('One or more tag IDs do not exist in the database');
        }
      }

      // Clear old tag connections
      await this.prisma.postTag.deleteMany({
        where: { postId: id },
      });
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? (dto.title.trim() !== '' ? dto.title.trim() : 'Untitled Draft') : undefined,
        slug,
        excerpt: dto.excerpt !== undefined ? dto.excerpt.trim() : undefined,
        content: dto.content !== undefined ? dto.content : undefined,
        featuredImage: dto.featuredImage !== undefined ? dto.featuredImage : undefined,
        status: dto.status || undefined,
        featured: dto.featured !== undefined ? dto.featured : undefined,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
        seoTitle: dto.seoTitle !== undefined ? (dto.seoTitle?.trim() || null) : undefined,
        seoDescription: dto.seoDescription !== undefined ? (dto.seoDescription?.trim() || null) : undefined,
        tags: dto.tagIds
          ? {
              create: dto.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
      },
    });
  }

  // Delete Post
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({
      where: { id },
    });
  }
}
