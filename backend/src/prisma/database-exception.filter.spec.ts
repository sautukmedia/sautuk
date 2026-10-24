import { type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { DatabaseExceptionFilter } from './database-exception.filter';

describe('database unavailable responses', () => {
  function setup() {
    const response = {};
    const adapter = { reply: jest.fn(), setHeader: jest.fn() };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    const filter = new DatabaseExceptionFilter({
      httpAdapter: adapter,
    } as unknown as HttpAdapterHost);
    return { adapter, host, filter, response };
  }

  afterEach(() => jest.restoreAllMocks());

  it.each(['P1001', 'P1002', 'P1017'])(
    'returns a safe 503 for %s instead of an internal server error',
    (code) => {
      const { adapter, host, filter, response } = setup();
      const fallback = jest
        .spyOn(BaseExceptionFilter.prototype, 'catch')
        .mockImplementation(() => {});
      filter.catch(
        new Prisma.PrismaClientKnownRequestError('private-host secret', {
          code,
          clientVersion: 'test',
        }),
        host,
      );
      expect(fallback).not.toHaveBeenCalled();
      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        {
          statusCode: 503,
          error: 'Service Unavailable',
          message:
            'Database temporarily unavailable. Please try again shortly.',
        },
        503,
      );
      expect(adapter.setHeader).toHaveBeenCalledWith(
        response,
        'Retry-After',
        '1',
      );
      expect(JSON.stringify(adapter.reply.mock.calls)).not.toContain(
        'private-host',
      );
    },
  );

  it('preserves normal handling for database integrity errors', () => {
    const { adapter, host, filter } = setup();
    const fallback = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => {});
    const error = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    filter.catch(error, host);
    expect(fallback).toHaveBeenCalledWith(error, host);
    expect(adapter.reply).not.toHaveBeenCalled();
  });
});
