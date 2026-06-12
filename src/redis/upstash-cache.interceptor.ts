import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from './redis.service';

/**
 * Custom decorator to specify TTL for the UpstashCacheInterceptor
 */
import { SetMetadata } from '@nestjs/common';
export const CACHE_TTL_KEY = 'upstash_cache_ttl';
export const CacheTTL = (ttlSeconds: number) => SetMetadata(CACHE_TTL_KEY, ttlSeconds);

import { Reflector } from '@nestjs/core';

@Injectable()
export class UpstashCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next.handle();
    }

    // Get TTL from metadata (default 60 seconds)
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler()) || 60;

    // Build Cache Key: Incorporate User scoping (id/role + branch) to prevent cross-contamination
    const user = req.user;
    const role = req.user?.role || 'public';
    const branchId = req.user?.branchId || 'global';
    // Stringify query params deterministically
    const urlKey = req.originalUrl;
    
    const cacheKey = `cache:${role}:${branchId}:${urlKey}`;

    // Try to get from Upstash
    const cachedResponse = await this.redisService.get<any>(cacheKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // If not cached, handle the request and intercept the response
    return next.handle().pipe(
      tap(async (response) => {
        // Only cache successful JSON responses
        if (response && typeof response === 'object') {
          // Store in Upstash in the background
          this.redisService.set(cacheKey, response, ttl).catch(err => {
            console.error('[UpstashCacheInterceptor] Failed to set cache', err);
          });
        }
      }),
    );
  }
}
