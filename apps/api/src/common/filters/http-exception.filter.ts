import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";

import { redactSensitiveUrl } from "../http/redact-sensitive-url";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : "Internal server error";
    const redactedUrl = redactSensitiveUrl(request.url);

    if (exception instanceof Error) {
      this.logger.error(`${request.method} ${redactedUrl} -> ${status} ${message}`, exception.stack);
    } else {
      this.logger.error(`${request.method} ${redactedUrl} -> ${status} ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      path: redactedUrl,
      timestamp: new Date().toISOString(),
      message
    });
  }
}
