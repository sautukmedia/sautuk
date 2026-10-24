import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';
import { AuthService } from '../../modules/auth/auth.service';
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
    auth = { validateAccessToken: jest.fn(async () => ({ id: 'admin', role: 'ADMIN' })) };
    interceptor = new PublicCacheInterceptor({} as Cache, new Reflector(), jwt, auth as unknown as AuthService);
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
    return jwt.sign({ sub: 'admin', role: 'ADMIN', sessionVersion: 'test-session' }, { secret: process.env.JWT_SECRET, expiresIn: '1h' });
  }

  it.each([undefined, '', 'Basic arbitrary', 'arbitrary authorization value', 'Bearer not-a-jwt'])(
    'uses the public URL cache key for unverified credentials: %s', async authorization => {
      await expect(interceptor.trackBy(context(authorization))).resolves.toBe(url);
      expect(auth.validateAccessToken).not.toHaveBeenCalled();
    },
  );

  it('uses the public cache for a correctly signed but revoked administrator session', async () => {
    auth.validateAccessToken.mockRejectedValue(new UnauthorizedException('Session revoked'));
    await expect(interceptor.trackBy(context(`Bearer ${token()}`))).resolves.toBe(url);
    expect(auth.validateAccessToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'admin', sessionVersion: 'test-session' }));
  });

  it('bypasses the shared public cache for a current administrator session', async () => {
    await expect(interceptor.trackBy(context(`Bearer ${token()}`))).resolves.toBeUndefined();
    expect(auth.validateAccessToken).toHaveBeenCalledTimes(1);
  });
});
