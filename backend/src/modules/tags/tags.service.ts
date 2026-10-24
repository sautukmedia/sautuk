import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { invalidateContentCache } from '../../common/content-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService, @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache) {}

  // Helper function to slugify names (supports Unicode/Hindi characters)
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '') // Keep letters, marks, numbers, spaces, hyphens
      .replace(/[\s_-]+/g, '-')               // Replace spaces, underscores, and hyphens with single hyphen
      .replace(/^-+|-+$/g, '');               // Trim leading/trailing hyphens
  }

  // Create Tag
  async create(dto: CreateTagDto) {
    const name = dto.name.trim();
    if (!this.slugify(name)) throw new BadRequestException('Tag name must contain letters or numbers');
    const slug = dto.slug && dto.slug.trim() !== '' 
      ? this.slugify(dto.slug) 
      : this.slugify(name);
    if (!slug) throw new BadRequestException('Tag URL must contain letters or numbers');

    // Check slug uniqueness
    const existing = await this.prisma.tag.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tag with slug '${slug}' already exists`);
    }

    const result = await this.prisma.tag.create({
      data: { name, slug },
    }).catch(error => {
      if (error.code === 'P2002') throw new ConflictException('Tag URL already exists');
      throw error;
    });
    await invalidateContentCache(this.cache);
    return result;
  }

  // Find all Tags
  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Find one by ID
  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID '${id}' not found`);
    }
    return tag;
  }

  // Update Tag
  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.findOne(id);

    const name = dto.name !== undefined ? (typeof dto.name === 'string' ? dto.name.trim() : '') : tag.name;
    if (!this.slugify(name)) throw new BadRequestException('Tag name must contain letters or numbers');
    let slug = tag.slug;

    if (dto.slug && dto.slug.trim() !== '') {
      slug = this.slugify(dto.slug);
    } else if (dto.name) {
      slug = this.slugify(dto.name);
    }
    if (!slug) throw new BadRequestException('Tag URL must contain letters or numbers');

    // Check if slug conflicts with other tags
    if (slug !== tag.slug) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Tag with slug '${slug}' already exists`);
      }
    }

    const result = await this.prisma.tag.update({
      where: { id },
      data: { name, slug },
    }).catch(error => {
      if (error.code === 'P2002') throw new ConflictException('Tag URL already exists');
      throw error;
    });
    await invalidateContentCache(this.cache);
    return result;
  }

  // Delete Tag
  async remove(id: string) {
    await this.findOne(id);
    const result = await this.prisma.tag.delete({
      where: { id },
    });
    await invalidateContentCache(this.cache);
    return result;
  }
}
