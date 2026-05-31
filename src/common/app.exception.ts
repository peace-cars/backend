import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    public readonly message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: any,
  ) {
    super(
      {
        statusCode: status,
        errorCode,
        message,
        details,
      },
      status,
    );
  }
}
