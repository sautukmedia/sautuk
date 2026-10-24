import { ConflictException } from '@nestjs/common';
import { PostsService } from './posts.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Cache } from 'cache-manager';
it('rejects a stale editor without overwriting the latest article', async () => {
  const current = {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'story',
    status: 'DRAFT',
    updatedAt: new Date('2026-10-24T00:00:01Z'),
    title: 'Latest version',
    featured: false,
  };
  const db = {
    post: {
      findUnique: () => Promise.resolve(current),
      update: jest.fn(() => Promise.resolve(current)),
    },
  };
  const service = new PostsService(db as unknown as PrismaService, {} as Cache);
  await expect(
    service.update(current.id, {
      title: 'Old version',
      expectedUpdatedAt: '2026-10-24T00:00:00.000Z',
    }),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(current.title).toBe('Latest version');
});
