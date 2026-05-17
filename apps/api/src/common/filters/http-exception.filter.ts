import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { ZodError } from "zod";

import { redactSensitiveUrl } from "../http/redact-sensitive-url";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();

    const status = getStatusCode(exception);
    const message = getResponseMessage(exception);

    const redactedUrl = redactSensitiveUrl(request.url);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
      this.logger.error(`${request.method} ${redactedUrl} -> ${status} ${message}`, exception.stack);
    } else if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${redactedUrl} -> ${status} ${message}`);
    } else {
      this.logger.warn(`${request.method} ${redactedUrl} -> ${status} ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      path: redactedUrl,
      timestamp: new Date().toISOString(),
      message,
      ...(exception instanceof ZodError
        ? {
          issues: exception.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
        : {})
    });
  }
}

function getStatusCode(exception: unknown) {
  if (exception instanceof ZodError) {
    return HttpStatus.BAD_REQUEST;
  }

  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getResponseMessage(exception: unknown) {
  if (exception instanceof ZodError) {
    return "Invalid request body";
  }

  if (exception instanceof HttpException) {
    return exception.message;
  }

  return "Internal server error";
}
