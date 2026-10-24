import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import type { Server } from 'node:http';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

@Controller('test-database-outage')
class OutageController {
  @Get()
  read() {
    throw new Prisma.PrismaClientKnownRequestError(
      'private database hostname',
      {
        code: 'P1001',
        clientVersion: 'test',
      },
    );
  }
}

describe('database exception filter registration', () => {
  let app: INestApplication<Server>;
  afterEach(async () => {
    if (app) await app.close();
  });

  it('serves a safe HTTP 503 through the registered Prisma module filter', async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [OutageController],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/test-database-outage')
      .expect(503)
      .expect('Retry-After', '1');
    expect(response.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Database temporarily unavailable. Please try again shortly.',
    });
  });
});
