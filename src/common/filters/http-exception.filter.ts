import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        response.status(status).json({
          statusCode: status,
          message: body.message ?? exception.message,
          error: body.error ?? HttpExceptionFilter.errorLabel(status),
        });
        return;
      }

      response.status(status).json({
        statusCode: status,
        message: exception.message,
        error: HttpExceptionFilter.errorLabel(status),
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }

  private static errorLabel(status: number): string {
    const labels: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      500: 'Internal Server Error',
    };
    return labels[status] ?? 'Error';
  }
}
