import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('public view tracking', () => {
  function setup(status = 'PUBLISHED', counts: number[] = []) {
    const post = {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'story',
      status,
    };
    const rows = counts.map((views, i) => ({
      id: `analytics-${i}`,
      postId: post.id,
      views,
    }));
    let tail = Promise.resolve();
    let beforeLock = () => {};
    const prisma = {
      post: { findUnique: () => Promise.resolve({ ...post }) },
      analytics: {
        findFirst: () => Promise.resolve(rows[0] || null),
        findMany: () => Promise.resolve([...rows]),
        create: ({ data }: { data: { postId: string; views: number } }) => {
          const row = { id: `analytics-${rows.length}`, ...data };
          rows.push(row);
          return Promise.resolve(row);
        },
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: { views: number | { increment: number } };
        }) => {
          const row = rows.find((row) => row.id === where.id)!;
          row.views =
            typeof data.views === 'number'
              ? data.views
              : row.views + data.views.increment;
          return Promise.resolve(row);
        },
        deleteMany: ({ where }: { where: { id: { not: string } } }) => {
          for (let i = rows.length - 1; i >= 0; i--)
            if (rows[i].id !== where.id.not) rows.splice(i, 1);
          return Promise.resolve();
        },
      },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        let release: (() => void) | undefined;
        const tx = {
          ...prisma,
          $executeRaw: async () => {
            beforeLock();
            const previous = tail;
            tail = new Promise<void>((resolve) => {
              release = resolve;
            });
            await previous;
            return 1;
          },
        };
        try {
          return await work(tx);
        } finally {
          release?.();
        }
      },
    };
    return {
      post,
      rows,
      service: new PostsService(
        prisma as unknown as PrismaService,
        {} as Cache,
      ),
      beforeLock: (callback: () => void) => {
        beforeLock = callback;
      },
    };
  }
  it('counts concurrent first views once each in a single analytics row', async () => {
    const { service, rows } = setup();
    await Promise.all(
      Array.from({ length: 6 }, () => service.trackView('story')),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(6);
  });
  it('merges legacy duplicate rows without losing their accumulated views', async () => {
    const { service, rows } = setup('PUBLISHED', [3, 4]);
    await service.trackView('story');
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(8);
  });
  it('does not record or expose a draft through the public tracking endpoint', async () => {
    const { service, rows } = setup('DRAFT');
    await expect(service.trackView('story')).rejects.toMatchObject({
      status: 404,
    });
    expect(rows).toHaveLength(0);
  });
  it('rechecks publication after acquiring the tracking lock', async () => {
    const fixture = setup();
    fixture.beforeLock(() => {
      fixture.post.status = 'DRAFT';
    });
    await expect(fixture.service.trackView('story')).rejects.toMatchObject({
      status: 404,
    });
    expect(fixture.rows).toHaveLength(0);
  });
});
