import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
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

  // Create Category
  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const slug = dto.slug && dto.slug.trim() !== '' 
      ? this.slugify(dto.slug) 
      : this.slugify(name);

    // Check slug uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug '${slug}' already exists`);
    }

    return this.prisma.category.create({
      data: { name, slug },
    });
  }

  // Find all Categories
  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Find one by ID
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }
    return category;
  }

  // Update Category
  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    const name = dto.name ? dto.name.trim() : category.name;
    let slug = category.slug;

    if (dto.slug && dto.slug.trim() !== '') {
      slug = this.slugify(dto.slug);
    } else if (dto.name) {
      slug = this.slugify(dto.name);
    }

    // Check if slug conflicts with other categories
    if (slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category with slug '${slug}' already exists`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: { name, slug },
    });
  }

  // Delete Category
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
