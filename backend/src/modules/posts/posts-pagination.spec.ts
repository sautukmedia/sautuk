import { BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Cache } from 'cache-manager';
import { PostStatus, Prisma } from '@prisma/client';
it('bounds list queries and excludes full article bodies', async () => {
  const findMany = jest
    .fn<Promise<never[]>, [Prisma.PostFindManyArgs]>()
    .mockResolvedValue([]);
  const service = new PostsService(
    { post: { findMany } } as unknown as PrismaService,
    {} as Cache,
  );
  await service.findAll({});
  expect(findMany.mock.calls[0]?.[0]).toMatchObject({
    take: 24,
    skip: 0,
    select: { id: true, title: true },
  });
  expect(
    (findMany.mock.calls[0]?.[0] as { select?: { content?: boolean } })?.select
      ?.content,
  ).not.toBe(true);
});
it('rejects abusive or invalid pagination values', async () => {
  const service = new PostsService({} as PrismaService, {} as Cache);
  await expect(service.findAll({ limit: 100000 })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(service.findAll({ page: -1 })).rejects.toBeInstanceOf(
    BadRequestException,
  );
});

it('ranks popular articles in a bounded parameterized query and preserves ranking when fetching summaries', async () => {
  const queryRaw = jest
    .fn<Promise<{ id: string }[]>, [Prisma.Sql]>()
    .mockResolvedValue([{ id: 'popular' }, { id: 'other' }]);
  const findMany = jest
    .fn<Promise<{ id: string; title: string }[]>, [Prisma.PostFindManyArgs]>()
    .mockResolvedValue([
      { id: 'other', title: 'Other article' },
      { id: 'popular', title: 'Most popular article' },
    ]);
  const service = new PostsService(
    { $queryRaw: queryRaw, post: { findMany } } as unknown as PrismaService,
    {} as Cache,
  );
  const result = await service.findAll({
    popular: true,
    status: PostStatus.PUBLISHED,
    limit: 2,
    page: 3,
  });
  expect(result.map((post) => post.id)).toEqual(['popular', 'other']);
  expect(queryRaw).toHaveBeenCalledTimes(1);
  const query = queryRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
  expect(query.sql).toMatch(/WHERE[\s\S]*p\.status\s*=/);
  expect(query.sql).toMatch(/LIMIT\s+\?\s+OFFSET\s+\?/);
  expect(query.sql).not.toContain('PUBLISHED');
  expect(query.values).toEqual(
    expect.arrayContaining([PostStatus.PUBLISHED, 2, 4]),
  );
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany.mock.calls[0][0]).toMatchObject({
    where: {
      id: { in: ['popular', 'other'] },
      status: PostStatus.PUBLISHED,
    },
    take: 2,
    skip: 0,
  });
  const options = findMany.mock.calls[0][0] as {
    select: { content?: boolean };
  };
  expect(options.select.content).not.toBe(true);
});
