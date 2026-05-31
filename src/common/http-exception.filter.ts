import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AppException } from './app.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const correlationId = request['correlationId'] || 'unknown';

    // Detect Postgrest/Supabase specific errors
    const isPostgrestError = exception && typeof exception === 'object' && 'code' in exception && 'details' in exception;

    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : isPostgrestError 
          ? HttpStatus.INTERNAL_SERVER_ERROR 
          : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (isPostgrestError) {
      message = 'Database operation failed.';
    }

    // Log the actual error for debugging, but hide stack traces from the client
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[Req-ID: ${correlationId}] [${request.method}] ${request.url} - 500: ${JSON.stringify(exception)}`,
        (exception as any)?.stack || ''
      );
    } else {
      this.logger.warn(`[Req-ID: ${correlationId}] [${request.method}] ${request.url} - ${status}: ${JSON.stringify(message)}`);
    }

    // Sanitize response in production
    const isProduction = process.env.NODE_ENV === 'production';
    const clientResponse: any = typeof message === 'object' ? { ...message } : { message };

    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      clientResponse['message'] = 'An unexpected error occurred. Our team has been notified.';
    }

    // Standardize error code if not provided
    const errorCode = exception instanceof AppException 
      ? exception.errorCode 
      : (clientResponse['error'] || 'INTERNAL_ERROR').toUpperCase().replace(/\s+/g, '_');

    response.status(status).json({
      statusCode: status,
      errorCode,
      message: clientResponse['message'] || message,
      details: clientResponse['details'] || undefined,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
