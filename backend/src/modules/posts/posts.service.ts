import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostStatus, type Prisma } from '@prisma/client';
import { Parser } from 'htmlparser2';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // Invalidate public cache on mutations so readers receive immediate updates
  private async invalidateCache() {
    try {
      if (this.cacheManager && typeof (this.cacheManager as any).reset === 'function') {
        await (this.cacheManager as any).reset();
      } else if (this.cacheManager && (this.cacheManager as any).store && typeof (this.cacheManager as any).store.reset === 'function') {
        await (this.cacheManager as any).store.reset();
      }
    } catch (err) {
      console.warn('⚠️ Cache reset warning:', err);
    }
  }

  // Text slugifier utility (supports Unicode/Hindi characters)
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '') // Keep letters, marks, numbers, spaces, hyphens
      .replace(/[\s_-]+/g, '-')               // Replace spaces, underscores, and hyphens with single hyphen
      .replace(/^-+|-+$/g, '');               // Trim hyphens
  }

  // Parse editor HTML as text, retaining legacy Markdown support.
  private generateExcerptFromContent(content: string): string {
    if (!content) return '';
    let text = content;
    if (/<[a-z][\s\S]*>/i.test(content)) {
      const chunks: string[] = [];
      const hiddenTags = new Set(['script', 'style', 'template']);
      const blockTags = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'hr']);
      let hiddenDepth = 0;
      const parser = new Parser({
        onopentag(name) {
          if (hiddenTags.has(name)) hiddenDepth++;
          if (!hiddenDepth && blockTags.has(name)) chunks.push(' ');
        },
        ontext(value) { if (!hiddenDepth) chunks.push(value); },
        onclosetag(name) {
          if (hiddenTags.has(name)) hiddenDepth = Math.max(0, hiddenDepth - 1);
          if (!hiddenDepth && blockTags.has(name)) chunks.push(' ');
        },
      }, { decodeEntities: true });
      parser.end(content);
      text = chunks.join('');
    } else {
      text = content
      .replace(/!\[.*?\]\(.*?\)/g, '')         // Remove images
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')       // Remove links (keep text)
      .replace(/#{1,6}\s+(.*)/g, '$1')          // Remove headers
      .replace(/[*_`~>]/g, '');
    }
    const plainText = text.replace(/\s+/g, ' ').trim();

    if (plainText.length <= 160) {
      return plainText;
    }

    let truncated = plainText.substring(0, 160);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 120) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated + '...';
  }

  // Generates a unique slug by appending counters if collisions are detected
  private async generateUniqueSlug(title: string, customSlug?: string, excludePostId?: string, db: Prisma.TransactionClient = this.prisma): Promise<string> {
    const baseSlug = this.slugify(customSlug || '') || this.slugify(title) || 'post';
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.post.findUnique({
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
    const write = (db: Prisma.TransactionClient) => this.createOnce(dto, db);
    const post = await this.retrySlugConflict(() => dto.featured && dto.status === PostStatus.PUBLISHED ? this.withFeaturedSlotLock(write) : write(this.prisma));
    await this.invalidateCache();
    return post;
  }

  private withFeaturedSlotLock<T>(write: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async db => {
      // All requests that can claim a carousel slot share this transaction lock.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(1935762539, 1)`;
      return write(db);
    }, { maxWait: 10000, timeout: 15000 });
  }

  private async retrySlugConflict<T>(write: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await write();
      } catch (error) {
        const conflict = error as { code?: string; meta?: { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } };
        const target = conflict.meta?.target ?? conflict.meta?.driverAdapterError?.cause?.constraint?.fields;
        const isSlugConflict = conflict.code === 'P2002' && (Array.isArray(target) ? target.includes('slug') : typeof target === 'string' && /(?:^|_)slug(?:_|$)/.test(target));
        if (!isSlugConflict) throw error;
        if (attempt === 4) throw new ConflictException('Unable to allocate a unique post URL. Please retry.');
      }
    }
    throw new ConflictException('Unable to allocate a unique post URL.');
  }

  private async createOnce(dto: CreatePostDto, db: Prisma.TransactionClient) {
    if (dto.status === PostStatus.PUBLISHED) {
      if (!dto.title || dto.title.trim() === '' || dto.title.trim() === 'Untitled Draft') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक वैध शीर्षक (Headline) आवश्यक है।');
      }
      if (!dto.categoryId) {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक श्रेणी (Category) चुनना आवश्यक है।');
      }
      if (!dto.featuredImage || dto.featuredImage.trim() === '') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक कवर चित्र (Cover Image) आवश्यक है।');
      }
      if (!dto.content || dto.content.trim() === '') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए सामग्री (Content) आवश्यक है।');
      }
      if (!dto.excerpt || dto.excerpt.trim() === '') {
        dto.excerpt = this.generateExcerptFromContent(dto.content);
      }
    }

    // Enforce carousel limit (max 5 published featured posts)
    if (dto.featured === true && dto.status === PostStatus.PUBLISHED) {
      const featuredCount = await db.post.count({
        where: { featured: true, status: PostStatus.PUBLISHED },
      });
      if (featuredCount >= 5) {
        throw new BadRequestException('होमपेज कैरोसेल पर पहले से ही 5 लेख पिन हैं। नया लेख पिन करने के लिए किसी पुराने लेख को अनपिन करें।');
      }
    }

    const postTitle = dto.title?.trim() !== '' ? (dto.title?.trim() || 'Untitled Draft') : 'Untitled Draft';
    const slug = await this.generateUniqueSlug(postTitle, dto.slug, undefined, db);

    // Verify category if categoryId is provided
    if (dto.categoryId) {
      const category = await db.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    // Verify tag existence if tags are provided
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tagCount = await db.tag.count({
        where: { id: { in: dto.tagIds } },
      });
      if (tagCount !== dto.tagIds.length) {
        throw new NotFoundException('One or more tag IDs do not exist in the database');
      }
    }

    const post = await db.post.create({
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

    return post;
  }

  // Find all posts with dynamic filters (status, category, tags, search)
  async findAll(filters: {
    status?: PostStatus;
    categoryId?: string;
    tagId?: string;
    q?: string;
    featured?: boolean;
    popular?: boolean;
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

    const posts = await this.prisma.post.findMany({
      where,
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (filters.popular) {
      return posts.sort((a, b) => {
        const viewsA = a.analytics?.reduce((sum, item) => sum + item.views, 0) || 0;
        const viewsB = b.analytics?.reduce((sum, item) => sum + item.views, 0) || 0;
        if (viewsA !== viewsB) {
          return viewsB - viewsA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return posts;
  }

  // Find one by ID or Slug
  async findOne(idOrSlug: string, onlyPublished = false, db: Prisma.TransactionClient = this.prisma) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const post = await db.post.findUnique({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
        analytics: true,
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
    const write = (db: Prisma.TransactionClient) => this.updateOnce(id, dto, db);
    const post = await this.retrySlugConflict(() => dto.featured === true || dto.status === PostStatus.PUBLISHED ? this.withFeaturedSlotLock(write) : write(this.prisma));
    await this.invalidateCache();
    return post;
  }

  private async updateOnce(id: string, dto: UpdatePostDto, db: Prisma.TransactionClient) {
    const post = await this.findOne(id, false, db);

    const targetStatus = dto.status !== undefined ? dto.status : post.status;

    if (targetStatus === PostStatus.PUBLISHED) {
      // Validate title
      const finalTitle = dto.title !== undefined ? dto.title.trim() : post.title;
      if (!finalTitle || finalTitle === '' || finalTitle === 'Untitled Draft') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक वैध शीर्षक (Headline) आवश्यक है।');
      }

      // Validate categoryId
      const finalCategory = dto.categoryId !== undefined ? dto.categoryId : post.categoryId;
      if (!finalCategory) {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक श्रेणी (Category) चुनना आवश्यक है।');
      }

      // Validate featuredImage
      const finalImage = dto.featuredImage !== undefined ? dto.featuredImage : post.featuredImage;
      if (!finalImage || finalImage.trim() === '') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए एक कवर चित्र (Cover Image) आवश्यक है।');
      }

      // Validate content
      const finalContent = dto.content !== undefined ? dto.content : post.content;
      if (!finalContent || finalContent.trim() === '') {
        throw new BadRequestException('लेख को लाइव प्रकाशित करने के लिए सामग्री (Content) आवश्यक है।');
      }

      // Validate or generate excerpt
      const finalExcerpt = dto.excerpt !== undefined ? dto.excerpt : post.excerpt;
      if (!finalExcerpt || finalExcerpt.trim() === '') {
        dto.excerpt = this.generateExcerptFromContent(finalContent);
      }
    }

    // Enforce carousel limit (max 5 published featured posts)
    const targetFeatured = dto.featured !== undefined ? dto.featured : post.featured;
    if (targetFeatured === true && targetStatus === PostStatus.PUBLISHED) {
      const featuredCount = await db.post.count({
        where: {
          featured: true,
          status: PostStatus.PUBLISHED,
          id: { not: id }
        },
      });
      if (featuredCount >= 5) {
        throw new BadRequestException('होमपेज कैरोसेल पर पहले से ही 5 लेख पिन हैं। नया लेख पिन करने के लिए किसी पुराने लेख को अनपिन करें।');
      }
    }

    let slug = post.slug;
    if (dto.title || dto.slug) {
      slug = await this.generateUniqueSlug(dto.title || post.title, dto.slug, id, db);
    }

    // Verify category if changing categoryId
    if (dto.categoryId) {
      const category = await db.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    // Verify tag existence if tags are being updated
    if (dto.tagIds) {
      if (dto.tagIds.length > 0) {
        const tagCount = await db.tag.count({
          where: { id: { in: dto.tagIds } },
        });
        if (tagCount !== dto.tagIds.length) {
          throw new NotFoundException('One or more tag IDs do not exist in the database');
        }
      }

    }

    const updatedPost = await db.post.update({
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
              deleteMany: {},
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

    return updatedPost;
  }

  // Delete Post
  async remove(id: string) {
    await this.findOne(id);
    const deletedPost = await this.prisma.post.delete({
      where: { id },
    });
    await this.invalidateCache();
    return deletedPost;
  }

  // Record view count (Public)
  async trackView(idOrSlug: string) {
    const post = await this.findOne(idOrSlug);

    // Find the first analytics row linked to this post
    let analytics = await this.prisma.analytics.findFirst({
      where: { postId: post.id },
    });

    if (analytics) {
      return this.prisma.analytics.update({
        where: { id: analytics.id },
        data: { views: { increment: 1 } },
      });
    } else {
      return this.prisma.analytics.create({
        data: {
          postId: post.id,
          views: 1,
        },
      });
    }
  }
}
