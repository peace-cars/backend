import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

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
        `[${request.method}] ${request.url} - 500: ${JSON.stringify(exception)}`,
        (exception as any)?.stack || ''
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status}: ${JSON.stringify(message)}`);
    }

    // Sanitize response in production
    const isProduction = process.env.NODE_ENV === 'production';
    const clientResponse: any = typeof message === 'object' ? { ...message } : { message };

    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      clientResponse['message'] = 'An unexpected error occurred. Our team has been notified.';
    }

    response.status(status).json({
      ...clientResponse,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
