import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseExceptionFilter } from './database-exception.filter';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
