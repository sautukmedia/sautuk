import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('featured carousel capacity', () => {
  function setup() {
    const posts = Array.from({ length: 4 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      title: `Story ${i}`,
      slug: `story-${i}`,
      status: 'PUBLISHED',
      featured: true,
      categoryId: 'category',
      content: '<p>Content</p>',
      featuredImage: 'image',
      excerpt: 'Excerpt',
    }));
    let tail = Promise.resolve();
    const prisma = {
      post: {
        count: ({ where }: { where: { id?: { not: string } } }) =>
          Promise.resolve(
            posts.filter(
              (post) =>
                post.featured &&
                post.status === 'PUBLISHED' &&
                post.id !== where.id?.not,
            ).length,
          ),
        findUnique: ({ where }: { where: { id?: string; slug?: string } }) =>
          Promise.resolve(
            posts.find((post) =>
              where.id ? post.id === where.id : post.slug === where.slug,
            ),
          ),
        create: ({ data }: { data: (typeof posts)[number] }) => {
          const post = {
            ...data,
            id: `00000000-0000-4000-8000-${String(posts.length).padStart(12, '0')}`,
          };
          posts.push(post);
          return Promise.resolve(post);
        },
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<(typeof posts)[number]>;
        }) => {
          const post = posts.find((post) => post.id === where.id)!;
          Object.assign(
            post,
            Object.fromEntries(
              Object.entries(data).filter(([, value]) => value !== undefined),
            ),
          );
          return Promise.resolve(post);
        },
      },
      category: { findUnique: () => Promise.resolve({ id: 'category' }) },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        let release: (() => void) | undefined;
        const tx = {
          ...prisma,
          $executeRaw: async () => {
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
      posts,
      service: new PostsService(
        prisma as unknown as PrismaService,
        {} as Cache,
      ),
    };
  }
  const published = {
    title: 'New story',
    status: 'PUBLISHED' as const,
    featured: true,
    categoryId: 'category',
    featuredImage: 'image',
    content: '<p>Content</p>',
    excerpt: 'Excerpt',
  };

  it('allows only one concurrent create to claim the fifth featured slot', async () => {
    const { service, posts } = setup();
    const results = await Promise.allSettled([
      service.create(published),
      service.create({ ...published, title: 'Other story' }),
    ]);
    expect(
      posts.filter((post) => post.featured && post.status === 'PUBLISHED'),
    ).toHaveLength(5);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
  });
  it('allows only one concurrent update to claim the fifth featured slot', async () => {
    const { service, posts } = setup();
    const one = await service.create({
      ...published,
      title: 'Draft one',
      status: 'DRAFT',
      featured: false,
    });
    const two = await service.create({
      ...published,
      title: 'Draft two',
      status: 'DRAFT',
      featured: false,
    });
    const results = await Promise.allSettled([
      service.update(one.id, { status: 'PUBLISHED', featured: true }),
      service.update(two.id, { status: 'PUBLISHED', featured: true }),
    ]);
    expect(
      posts.filter((post) => post.featured && post.status === 'PUBLISHED'),
    ).toHaveLength(5);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
  });
});
