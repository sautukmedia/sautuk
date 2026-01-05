import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class PublicCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): any {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    // If the user provides an authorization header, they are likely an admin.
    // We bypass the cache so they always see the latest fresh data, including drafts.
    if (authHeader) {
      return undefined;
    }
    
    // Otherwise, use the default cache key generator (the request URL)
    return super.trackBy(context);
  }
}
