import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../modules/auth/auth.service';
import { contentCacheGeneration } from '../content-cache';

@Injectable()
export class PublicCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cache: Cache,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {
    super(cache, reflector);
  }

  async trackBy(context: ExecutionContext): Promise<string | undefined | null> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify(authHeader.slice(7), {
          secret: process.env.JWT_SECRET,
        });
        await this.auth.validateAccessToken(payload);
        return undefined;
      } catch {
        /* Invalid credentials use the same public cache as other readers. */
      }
    }

    // Otherwise, use the default cache key generator (the request URL)
    const key = await super.trackBy(context);
    return key ? `${contentCacheGeneration()}:${key}` : key;
  }
}
