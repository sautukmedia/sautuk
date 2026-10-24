import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  private pendingProbe?: Promise<void>;
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      this.pendingProbe ??= this.prisma.$queryRaw`SELECT 1`
        .then(() => undefined)
        .finally(() => {
          this.pendingProbe = undefined;
        });
      await Promise.race([
        this.pendingProbe,
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(
            () => reject(new Error('Readiness deadline exceeded')),
            2000,
          );
        }),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Service temporarily unavailable');
    } finally {
      clearTimeout(deadline);
    }
  }
}
