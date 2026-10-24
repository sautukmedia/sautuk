import { SubscribersService } from './subscribers.service';
import type { PrismaService } from '../../prisma/prisma.service';
it('treats simultaneous duplicate subscriptions as successful and stores one email', async () => {
  const emails = new Set<string>();
  const db = {
    subscriber: {
      findUnique: () => Promise.resolve(null),
      create: ({ data }: { data: { email: string } }) => {
        if (emails.has(data.email))
          return Promise.reject(
            Object.assign(new Error('Duplicate subscriber'), { code: 'P2002' }),
          );
        emails.add(data.email);
        return Promise.resolve();
      },
    },
  };
  const service = new SubscribersService(db as unknown as PrismaService);
  const results = await Promise.all([
    service.subscribe('Same@example.test'),
    service.subscribe(' same@example.test '),
  ]);
  expect(results.every((result) => result.success)).toBe(true);
  expect([...emails]).toEqual(['same@example.test']);
});
