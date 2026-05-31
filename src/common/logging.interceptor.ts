import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const method = request.method;
    const url = request.url;
    const correlationId = request['correlationId'] || 'unknown';
    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - now;
          
          if (duration > 2000) {
            this.logger.warn(`[Req-ID: ${correlationId}] ${method} ${url} ${statusCode} - SLOW REQUEST: ${duration}ms`);
          } else {
            this.logger.log(`[Req-ID: ${correlationId}] ${method} ${url} ${statusCode} - ${duration}ms`);
          }
        }),
      );
  }
}
