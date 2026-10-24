import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PostsService } from '../posts/posts.service';
import { SeoService } from './seo.service';
import { sanitizeArticle } from './seo-html';

describe('public discovery and server-rendered content', () => {
  const post = {
    id: 'one',
    slug: 'हिंदी-लेख',
    title: 'Headline <test>',
    excerpt: 'A useful summary',
    content: '<h2>Facts</h2><p>Story &amp; references.</p>',
    status: 'PUBLISHED',
    seoTitle: 'Custom title',
    seoDescription: 'Custom description',
    featuredImage: 'https://cdn.example/image.jpg',
    category: { name: 'जलवायु' },
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
  };
  function setup() {
    const findFirst = jest.fn().mockResolvedValue(post);
    const findMany = jest.fn().mockResolvedValue([post]);
    const count = jest.fn().mockResolvedValue(1001);
    const prisma = { post: { findFirst, findMany, count } };
    const service = new SeoService(
      prisma as unknown as PrismaService,
      {
        findAll: jest.fn().mockResolvedValue([post]),
      } as unknown as PostsService,
    );
    return { service, findFirst, findMany, count };
  }
  it('uses published-only lookups and preserves article metadata and readable HTML', async () => {
    const { service, findFirst } = setup();
    const page = await service.article(post.slug);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: post.slug, status: 'PUBLISHED' },
      }),
    );
    expect(page).toMatchObject({
      title: 'Custom title',
      description: 'Custom description',
      type: 'article',
    });
    expect(page.html).toContain('<h2>Facts</h2>');
    expect(page.canonical).toContain(encodeURIComponent(post.slug));
    expect(JSON.stringify(page.jsonLd)).toContain('NewsArticle');
  });
  it('returns 404 for unpublished or absent articles', async () => {
    const { service, findFirst } = setup();
    findFirst.mockResolvedValue(null);
    await expect(service.article('draft')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('splits sitemaps into bounded pages and escapes XML titles in feeds', async () => {
    const { service, findMany } = setup();
    expect(await service.sitemapIndex()).toContain('/sitemaps/articles-2.xml');
    const xml = await service.sitemapPage(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1000,
        skip: 1000,
        where: { status: 'PUBLISHED' },
      }),
    );
    expect(xml).not.toContain('undefined');
    expect(await service.rss()).toContain('Headline &lt;test&gt;');
    expect(await service.llms()).toContain('A useful summary');
    await expect(service.sitemapPage(0)).rejects.toThrow();
  });
  it('removes executable content, unsafe links and arbitrary styles while preserving figures', () => {
    const clean = sanitizeArticle(
      '<script>alert(1)</script><p onclick="bad()">Text <a href="javascript:bad()">link</a></p><figure data-article-figure data-placement="left" data-width="40" style="position:fixed"><img src="https://cdn.example/a.jpg" onerror="bad()"><figcaption>चित्र 1</figcaption></figure><iframe>hidden</iframe>',
    );
    expect(clean).toContain('data-placement="left"');
    expect(clean).toContain('--figure-width:40%');
    expect(clean).not.toMatch(
      /<script|onclick|onerror|javascript:|position:fixed|hidden/,
    );
  });
});
