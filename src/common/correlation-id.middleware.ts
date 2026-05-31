import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerName = 'x-correlation-id';
    const correlationId = req.headers[headerName] || crypto.randomUUID();
    
    // Attach to request object for use in interceptors/services
    (req as any).correlationId = correlationId;
    
    // Ensure the response also includes it
    res.setHeader(headerName, correlationId);
    
    next();
  }
}
