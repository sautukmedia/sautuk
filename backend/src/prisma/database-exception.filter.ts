import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
)
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly databaseLogger = new Logger(DatabaseExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: Error, host: ArgumentsHost): void {
    const code =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : exception instanceof Prisma.PrismaClientInitializationError
          ? exception.errorCode
          : undefined;
    if (code && ['P1001', 'P1002', 'P1017'].includes(code)) {
      this.databaseLogger.warn(`Database connection unavailable (${code})`);
      const response = host.switchToHttp().getResponse<unknown>();
      this.adapterHost.httpAdapter.setHeader(response, 'Retry-After', '1');
      this.adapterHost.httpAdapter.reply(
        response,
        {
          statusCode: 503,
          error: 'Service Unavailable',
          message:
            'Database temporarily unavailable. Please try again shortly.',
        },
        503,
      );
      return;
    }
    super.catch(exception, host);
  }
}
