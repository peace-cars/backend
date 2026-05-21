import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data?: T;
  meta?: any;
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        // Handle cases where the controller already wrapped the response
        if (data && typeof data === 'object' && 'success' in data && ('data' in data || 'message' in data)) {
            return {
                ...data,
                timestamp: new Date().toISOString(),
                path: request.url,
            };
        }

        // Handle raw pagination metadata format if used
        if (data && typeof data === 'object' && data.data && data.meta) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
            timestamp: new Date().toISOString(),
            path: request.url,
          };
        }

        // Standard wrapping for raw data arrays or objects
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
