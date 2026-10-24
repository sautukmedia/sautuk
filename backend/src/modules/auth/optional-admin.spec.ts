import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PostStatus, Role } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PostsController } from '../posts/posts.controller';
import { PostsService } from '../posts/posts.service';

describe('optional administrator access to article reads', () => {
  let originalSecret: string | undefined;
  let controller: PostsController;
  let auth: { validateAccessToken: jest.Mock };
  let posts: { findAll: jest.Mock; findOne: jest.Mock };
  let token: string;
  const draft = {
    id: 'draft',
    status: PostStatus.DRAFT,
    content: 'Private draft body',
  };
  const published = {
    id: 'published',
    status: PostStatus.PUBLISHED,
    content: 'Public body',
  };
  const request = (bearer?: string) =>
    ({
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    }) as Request;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET =
      'test-only-optional-admin-secret-never-used-by-a-server';
    const jwt = new JwtService();
    token = jwt.sign(
      {
        sub: 'admin',
        email: 'admin@example.test',
        role: Role.ADMIN,
        sessionVersion: 'old-session',
      },
      { secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );
    auth = {
      validateAccessToken: jest.fn(async () => ({
        id: 'admin',
        role: Role.ADMIN,
      })),
    };
    posts = {
      findAll: jest.fn(async () => [published]),
      findOne: jest.fn(async () => draft),
    };
    controller = new PostsController(
      posts as unknown as PostsService,
      jwt,
      auth as unknown as AuthService,
    );
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('rejects a revoked administrator token requesting the draft feed', async () => {
    auth.validateAccessToken.mockRejectedValue(
      new UnauthorizedException('Session revoked'),
    );
    await expect(
      controller.findAll(
        undefined,
        undefined,
        undefined,
        PostStatus.DRAFT,
        undefined,
        undefined,
        request(token),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.validateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'admin', sessionVersion: 'old-session' }),
    );
    expect(posts.findAll).not.toHaveBeenCalled();
  });

  it('limits revoked-token requests for all articles to published articles', async () => {
    auth.validateAccessToken.mockRejectedValue(
      new UnauthorizedException('Session revoked'),
    );
    await expect(
      controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        request(token),
      ),
    ).resolves.toEqual([published]);
    expect(posts.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: PostStatus.PUBLISHED }),
    );
  });

  it('hides an individual draft from a revoked administrator token', async () => {
    auth.validateAccessToken.mockRejectedValue(
      new UnauthorizedException('Session revoked'),
    );
    await expect(
      controller.findOne('draft', request(token)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(auth.validateAccessToken).toHaveBeenCalledTimes(1);
  });

  it('allows a current administrator to request drafts and the unfiltered feed', async () => {
    await controller.findAll(
      undefined,
      undefined,
      undefined,
      PostStatus.DRAFT,
      undefined,
      undefined,
      request(token),
    );
    expect(posts.findAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: PostStatus.DRAFT }),
    );
    await controller.findAll(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      request(token),
    );
    expect(posts.findAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: undefined }),
    );
    expect(auth.validateAccessToken).toHaveBeenCalledTimes(2);
  });

  it('allows a current administrator to read an individual draft', async () => {
    await expect(controller.findOne('draft', request(token))).resolves.toEqual(
      draft,
    );
    expect(auth.validateAccessToken).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'keeps published articles public with a revoked token present: %s',
    async (withToken) => {
      posts.findOne.mockResolvedValue(published);
      auth.validateAccessToken.mockRejectedValue(
        new UnauthorizedException('Session revoked'),
      );
      await expect(
        controller.findOne('published', request(withToken ? token : undefined)),
      ).resolves.toEqual(published);
      expect(auth.validateAccessToken).not.toHaveBeenCalled();
    },
  );
});
