import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const LEGACY_API_PREFIXES = ['vehicles'];

@Injectable()
export class LegacyApiMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LegacyApiMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const isLegacy = LEGACY_API_PREFIXES.some(
      (prefix) =>
        req.path === `/${prefix}` || req.path.startsWith(`/${prefix}/`),
    );

    if (!req.path.startsWith('/api/') && isLegacy) {
      const original = req.originalUrl || req.url;
      req.url = `/api/v1${original}`;
      this.logger.warn(
        `Legacy API fallback applied: ${original} -> ${req.url}`,
      );
    }

    next();
  }
}
