import { createRequire } from 'node:module';
import { ResilientPool } from './resilient-pool';

const { PrismaPg } = createRequire(__filename)(
  '@prisma/adapter-pg',
) as typeof import('@prisma/adapter-pg');

it('passes the supplied pool through Prisma instead of treating it as connection configuration', async () => {
  const pool = new ResilientPool();
  const adapter = await new PrismaPg(pool).connect();
  try {
    expect(adapter.underlyingDriver()).toBe(pool);
  } finally {
    await adapter.dispose();
    await pool.end();
  }
});
