import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, PostStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as express from 'express';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly jwtService: JwtService,
  ) {}

  // Create Post (Admin Only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }

  // Find all posts with dynamic filtering (Public/Admin conditional)
  @Get()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('tagId') tagId?: string,
    @Query('q') q?: string,
    @Query('status') status?: PostStatus,
    @Req() req?: express.Request,
  ) {
    // Default to only showing PUBLISHED posts for readers
    let targetStatus: PostStatus | undefined = PostStatus.PUBLISHED;

    // Check if the requester is an admin by parsing the bearer token
    const authHeader = req?.headers?.authorization;
    let isAdmin = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        });
        if (decoded && decoded.role === Role.ADMIN) {
          isAdmin = true;
        }
      } catch (e) {
        // Token is invalid/expired; treat as public user
      }
    }

    if (isAdmin) {
      // Admin is allowed to request DRAFT, PUBLISHED, or all posts
      targetStatus = status; 
    } else {
      // Non-admins trying to access drafts receive a forbidden error
      if (status === PostStatus.DRAFT) {
        throw new ForbiddenException('Access denied: Insufficient permissions to view drafts');
      }
    }

    return this.postsService.findAll({
      status: targetStatus,
      categoryId,
      tagId,
      q,
    });
  }

  // Find single post by ID or Slug (Public/Admin conditional)
  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string, @Req() req: express.Request) {
    const post = await this.postsService.findOne(idOrSlug);

    // If it is a draft, we must ensure the requester is an authenticated Admin
    if (post.status === PostStatus.DRAFT) {
      const authHeader = req?.headers?.authorization;
      let isAdmin = false;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = this.jwtService.verify(token, {
            secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
          });
          if (decoded && decoded.role === Role.ADMIN) {
            isAdmin = true;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!isAdmin) {
        // Return 404 standard message instead of 403 to prevent draft leakage/discovery
        throw new NotFoundException(`Post with ID or slug '${idOrSlug}' not found`);
      }
    }

    return post;
  }

  // Update Post (Admin Only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.postsService.update(id, updatePostDto);
  }

  // Delete Post (Admin Only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }
}
