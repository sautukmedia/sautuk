import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from './prisma/prisma.service';

describe('HealthController', () => {
  function setup() {
    const prisma = { $queryRaw: jest.fn(async () => [{ '?column?': 1 }]) };
    return { prisma, controller: new HealthController(prisma as unknown as PrismaService) };
  }

  it('reports process liveness without depending on database availability', () => {
    const { prisma, controller } = setup();
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('checks database connectivity before reporting readiness', async () => {
    const { prisma, controller } = setup();
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
    expect(Array.from(query[0]).join('').trim()).toMatch(/^SELECT\s+1;?$/i);
  });

  it('returns a generic 503 when the database is unavailable', async () => {
    const { prisma, controller } = setup();
    prisma.$queryRaw.mockRejectedValue(new Error('private-db.example.test:5432 password=private-secret') as never);
    const error = await controller.ready().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const response = JSON.stringify((error as ServiceUnavailableException).getResponse());
    expect(response).not.toContain('private-db');
    expect(response).not.toContain('private-secret');
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
  });
});
