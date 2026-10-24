import { createCache } from 'cache-manager';
import { PostsService } from './posts.service';
import type { PrismaService } from '../../prisma/prisma.service';
it('removes public cached articles after a mutation with the installed cache manager', async () => {
  const cache = createCache();
  const db = { post: { findUnique: async () => ({ id: 'story', status: 'PUBLISHED' }), delete: async () => ({ id: 'story' }) } };
  const service = new PostsService(db as unknown as PrismaService, cache);
  await cache.set('/posts/story', { content: 'Withdrawn story' }, 60000);
  await service.remove('story');
  expect(await cache.get('/posts/story')).toBeUndefined();
  await cache.disconnect();
});
