import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('generated post excerpts', () => {
  const prisma = {
    post: {
      findUnique: () => Promise.resolve(null),
      create: ({ data }: { data: unknown }) => Promise.resolve(data),
    },
    category: { findUnique: () => Promise.resolve({ id: 'category' }) },
  };
  const service = new PostsService(
    prisma as unknown as PrismaService,
    {} as Cache,
  );
  it.each([
    [
      '<p>पहला &amp; दूसरा&nbsp;<strong>लेख</strong></p><p>अगला &#65; &#x42;</p>',
      'पहला & दूसरा लेख अगला A B',
    ],
    [
      '<p>2 &lt; 3 &copy;</p><script>bad()</script><style>.hidden{}</style><!-- secret -->',
      '2 < 3 ©',
    ],
    [
      '<p>Before<br>after <a href="https://example.test/?q=>">link</a>.</p>',
      'Before after link.',
    ],
    ['## Heading\n[Link](https://example.test) **bold**', 'Heading Link bold'],
  ])('extracts readable text from %s', async (content, expected) => {
    const post = await service.create({
      title: 'Story',
      status: 'PUBLISHED',
      categoryId: 'category',
      featuredImage: 'image',
      content,
    });
    expect(post.excerpt).toBe(expected);
  });
  it('preserves a supplied excerpt and bounds generated teaser length', async () => {
    const post = await service.create({
      title: 'Story',
      status: 'PUBLISHED',
      categoryId: 'category',
      featuredImage: 'image',
      content: '<p>word </p>'.repeat(100),
    });
    expect(post.excerpt.length).toBeLessThanOrEqual(163);
    expect(post.excerpt).not.toContain('<p>');
    const supplied = await service.create({
      title: 'Story',
      status: 'PUBLISHED',
      categoryId: 'category',
      featuredImage: 'image',
      content: '<p>Content</p>',
      excerpt: 'Custom teaser',
    });
    expect(supplied.excerpt).toBe('Custom teaser');
  });
});
