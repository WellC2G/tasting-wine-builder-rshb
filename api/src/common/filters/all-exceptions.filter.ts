import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface HttpExceptionBody {
  message?: string | string[];
}

const STATUS_LABELS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Некорректный запрос',
  [HttpStatus.UNAUTHORIZED]: 'Требуется авторизация',
  [HttpStatus.FORBIDDEN]: 'Доступ запрещён',
  [HttpStatus.NOT_FOUND]: 'Не найдено',
  [HttpStatus.CONFLICT]: 'Конфликт',
  [HttpStatus.GONE]: 'Ресурс больше не доступен',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Некорректные данные',
  [423]: 'Действие заблокировано',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Ошибка сервера',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Сервис недоступен',
};

/**
 * Ensures default NestJS error responses are localized in Russian.
 * Domain exceptions keep their custom Russian messages.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.handleWebSocketException(exception, host);
      return;
    }

    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[];

    if (exception instanceof HttpException) {
      message = this.extractMessage(exception, status);
    } else {
      this.logger.error(
        `Unhandled exception for ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      message = 'Внутренняя ошибка сервера';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: STATUS_LABELS[status] ?? 'Ошибка запроса',
    });
  }

  private handleWebSocketException(
    exception: unknown,
    host: ArgumentsHost,
  ): void {
    const client = host
      .switchToWs()
      .getClient<{ emit?: (event: string, payload: unknown) => void }>();
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Внутренняя ошибка сервера';

    if (client && typeof client.emit === 'function') {
      client.emit('session_error', { message });
    }
  }

  private extractMessage(
    exception: HttpException,
    status: number,
  ): string | string[] {
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return this.localizeDefaultMessage(body, status);
    }

    if (typeof body === 'object' && body !== null) {
      const { message } = body as HttpExceptionBody;

      if (Array.isArray(message)) {
        return message;
      }

      if (typeof message === 'string') {
        return this.localizeDefaultMessage(message, status);
      }
    }

    return this.localizeDefaultMessage(exception.message, status);
  }

  private localizeDefaultMessage(
    message: string,
    status: number,
  ): string {
    if (status === HttpStatus.NOT_FOUND && message.startsWith('Cannot ')) {
      return 'Маршрут не найден';
    }

    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      message === 'Internal server error'
    ) {
      return 'Внутренняя ошибка сервера';
    }

    return message;
  }
}
