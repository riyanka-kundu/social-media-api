import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  private configService: ConfigService;
  constructor() {
    this.configService = new ConfigService();
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionStatus: HttpStatus =
      (exception.getStatus && exception.getStatus()) ||
      HttpStatus.INTERNAL_SERVER_ERROR;

    const data: any = {
      statusCode: exceptionStatus,
      message: exception?.message || exception,
      stack:
        this.configService.getOrThrow<string>('NODE_ENV') === 'development'
          ? exception.stack
          : null,
    };

    switch (exceptionStatus) {
      case HttpStatus.BAD_REQUEST: {
        const exceptionResponse = exception.getResponse();
        if (
          typeof exceptionResponse === 'object' &&
          'message' in exceptionResponse
        ) {
          const messages = Array.isArray(exceptionResponse['message'])
            ? exceptionResponse['message']
            : [exceptionResponse['message']];
          data.message = messages[0];
        }
        break;
      }

      case HttpStatus.UNAUTHORIZED: {
        data.message = 'Unauthorized';
        break;
      }

      case HttpStatus.TOO_MANY_REQUESTS: {
        data.message = 'Too Many Requests';
        break;
      }

      default:
        break;
    }

    return response.status(exceptionStatus).json(data);
  }
}
