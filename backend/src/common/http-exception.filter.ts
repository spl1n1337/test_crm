import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") {
      throw exception;
    }
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      const error = Array.isArray(raw) ? raw[0] : raw;
      response.status(status).json({ error });
      return;
    }

    const message = exception instanceof Error ? exception.message : "Ошибка сервера";
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
