import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const slug = dto.slug && dto.slug.trim() !== '' 
      ? this.slugify(dto.slug) 
      : this.slugify(name);

    // Check slug uniqueness
    const existing = await this.prisma.tag.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tag with slug '${slug}' already exists`);
    }

    return this.prisma.tag.create({
      data: { name, slug },
    });
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

    const name = dto.name ? dto.name.trim() : tag.name;
    let slug = tag.slug;

    if (dto.slug && dto.slug.trim() !== '') {
      slug = this.slugify(dto.slug);
    } else if (dto.name) {
      slug = this.slugify(dto.name);
    }

    // Check if slug conflicts with other tags
    if (slug !== tag.slug) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Tag with slug '${slug}' already exists`);
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: { name, slug },
    });
  }

  // Delete Tag
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
