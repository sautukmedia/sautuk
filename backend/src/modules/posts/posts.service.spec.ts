import { PostStatus } from '@prisma/client';
import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('PostsService.update tag preservation', () => {
  it.each([{ tagIds: ['replacement-tag'] }, { tagIds: [] }])(
    'preserves existing tags when an update with tagIds $tagIds fails',
    async ({ tagIds }) => {
      const postId = '72e23cb9-8458-42b3-93fc-e69585f5b3e2';
      const originalTags = ['existing-tag'];
      let storedTags = [...originalTags];
      const updateFailure = new Error('Database rejected the post update');
      const prisma = {
        post: {
          findUnique: async () => ({
            id: postId,
            slug: 'existing-post',
            status: PostStatus.DRAFT,
            featured: false,
          }),
          // A failed Prisma nested write is atomic: none of its relation
          // changes persist. A separate deleteMany, however, already persists.
          update: async () => {
            throw updateFailure;
          },
        },
        tag: { count: async () => tagIds.length },
        postTag: {
          deleteMany: async () => {
            const count = storedTags.length;
            storedTags = [];
            return { count };
          },
        },
        // Also model rollback if the service uses an interactive transaction.
        $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
          const before = [...storedTags];
          try {
            return await work(prisma);
          } catch (error) {
            storedTags = before;
            throw error;
          }
        },
      };
      const service = new PostsService(
        prisma as unknown as PrismaService,
        {} as Cache,
      );

      await expect(service.update(postId, { tagIds })).rejects.toBe(updateFailure);

      expect(storedTags).toEqual(originalTags);
    },
  );
});
