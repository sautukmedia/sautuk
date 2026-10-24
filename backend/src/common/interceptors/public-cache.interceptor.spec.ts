import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';
import { createCache } from 'cache-manager';
import { AuthService } from '../../modules/auth/auth.service';
import { PostsService } from '../../modules/posts/posts.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PublicCacheInterceptor } from './public-cache.interceptor';

describe('PublicCacheInterceptor authentication cache policy', () => {
  const url = '/posts?status=PUBLISHED&page=1&limit=24';
  let previousSecret: string | undefined;
  let jwt: JwtService;
  let auth: { validateAccessToken: jest.Mock };
  let interceptor: PublicCacheInterceptor;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-public-cache-access-secret';
    jwt = new JwtService();
    auth = {
      validateAccessToken: jest.fn(() =>
        Promise.resolve({
          id: 'admin',
          role: 'ADMIN',
        }),
      ),
    };
    interceptor = new PublicCacheInterceptor(
      {} as Cache,
      new Reflector(),
      jwt,
      auth as unknown as AuthService,
    );
    Object.assign(interceptor, {
      httpAdapterHost: {
        httpAdapter: {
          getRequestMethod: (request: { method: string }) => request.method,
          getRequestUrl: (request: { url: string }) => request.url,
        },
      },
    });
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  function context(authorization?: string): ExecutionContext {
    const request = { method: 'GET', url, headers: { authorization } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getArgByIndex: () => request,
      getHandler: () => context,
      getClass: () => PublicCacheInterceptor,
    } as unknown as ExecutionContext;
  }

  function token() {
    return jwt.sign(
      { sub: 'admin', role: 'ADMIN', sessionVersion: 'test-session' },
      { secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );
  }

  it.each([
    undefined,
    '',
    'Basic arbitrary',
    'arbitrary authorization value',
    'Bearer not-a-jwt',
  ])(
    'uses the public URL cache key for unverified credentials: %s',
    async (authorization) => {
      const publicKey = await interceptor.trackBy(context());
      expect(publicKey?.endsWith(url)).toBe(true);
      await expect(interceptor.trackBy(context(authorization))).resolves.toBe(
        publicKey,
      );
      expect(auth.validateAccessToken).not.toHaveBeenCalled();
    },
  );

  it('uses the public cache for a correctly signed but revoked administrator session', async () => {
    const publicKey = await interceptor.trackBy(context());
    auth.validateAccessToken.mockRejectedValue(
      new UnauthorizedException('Session revoked'),
    );
    await expect(
      interceptor.trackBy(context(`Bearer ${token()}`)),
    ).resolves.toBe(publicKey);
    expect(auth.validateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'admin', sessionVersion: 'test-session' }),
    );
  });

  it('bypasses the shared public cache for a current administrator session', async () => {
    await expect(
      interceptor.trackBy(context(`Bearer ${token()}`)),
    ).resolves.toBeUndefined();
    expect(auth.validateAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not expose an old in-flight response cached after a successful deletion', async () => {
    const cache = createCache();
    const oldPost = {
      id: 'removed-story',
      slug: 'removed-story',
      status: 'PUBLISHED',
      content: 'Old public content',
    };
    const prisma = {
      post: {
        findUnique: jest.fn(() => Promise.resolve(oldPost)),
        delete: jest.fn(() => Promise.resolve(oldPost)),
      },
    };
    const posts = new PostsService(prisma as unknown as PrismaService, cache);
    // A GET began before the mutation and retained its original cache key.
    const oldKey = (await interceptor.trackBy(context()))!;
    await posts.remove(oldPost.id);
    // Its slow response arrives only after deletion has cleared the old cache.
    await cache.set(oldKey, oldPost, 60000);
    expect(await cache.get(oldKey)).toEqual(oldPost);
    const freshKey = (await interceptor.trackBy(context()))!;
    expect(freshKey).not.toBe(oldKey);
    expect(await cache.get(freshKey)).toBeUndefined();
  });
});
