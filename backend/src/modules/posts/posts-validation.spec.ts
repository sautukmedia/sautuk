import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('published article body validation', () => {
  function setup() {
    const prisma = {
      post: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'new-post',
            ...data,
          }),
        ),
      },
      category: {
        findUnique: jest.fn(() => Promise.resolve({ id: 'category' })),
      },
    };
    const service = new PostsService(
      prisma as unknown as PrismaService,
      { clear: jest.fn() } as unknown as Cache,
    );
    return { service, prisma };
  }

  const post = (content: string) => ({
    title: 'Valid headline',
    content,
    status: PostStatus.PUBLISHED,
    categoryId: 'category',
    featuredImage: 'https://example.test/cover.jpg',
  });

  it.each([
    '<p></p>',
    '<p>&nbsp;<br></p>',
    '<script>alert(1)</script><style>p{color:red}</style>',
    '<template>Hidden text</template>',
  ])(
    'rejects a published body without visible content: %s',
    async (content) => {
      const { service, prisma } = setup();
      await expect(service.create(post(content))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.post.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    '<p>वास्तविक लेख सामग्री</p>',
    '<p><img src="https://example.test/story.jpg" alt="Photo essay"></p>',
  ])('allows meaningful text or a photo-only article: %s', async (content) => {
    const { service, prisma } = setup();
    await expect(service.create(post(content))).resolves.toMatchObject({
      content,
    });
    expect(prisma.post.create).toHaveBeenCalledTimes(1);
  });
});
