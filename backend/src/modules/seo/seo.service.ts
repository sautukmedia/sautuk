import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import {
  articleText,
  escapeHtml as escape,
  publicUrl,
  sanitizeArticle,
} from './seo-html';

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
  ) {}
  private site() {
    const url = new URL(process.env.SITE_URL || 'https://sautuk.com');
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Invalid SITE_URL');
    return url.origin;
  }
  private link(slug: string) {
    return `${this.site()}/posts/${encodeURIComponent(slug)}`;
  }
  private publisher() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${this.site()}/#publisher`,
      name: 'Sautuk Media',
      url: this.site(),
      logo: {
        '@type': 'ImageObject',
        url: `${this.site()}/sautuk-logo-icon.png`,
      },
    };
  }
  async article(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { category: true, tags: { include: { tag: true } } },
    });
    if (!post) throw new NotFoundException('Article not found');
    const canonical = this.link(post.slug);
    const content = sanitizeArticle(post.content);
    const image = publicUrl(post.featuredImage);
    const title = post.seoTitle?.trim() || `${post.title} | सौतुक`;
    const description =
      post.seoDescription?.trim() || post.excerpt || post.title;
    const createdAt = post.createdAt.toISOString();
    const updatedAt = post.updatedAt.toISOString();
    const author = { '@type': 'Person', name: 'कुंदन पांडेय' };
    const html = `<header class="seo-brand"><a href="${this.site()}/">सौतुक</a></header><main class="seo-fallback reading-page"><article lang="hi"><h1>${escape(post.title)}</h1><p>${escape(post.excerpt)}</p><p>कुंदन पांडेय · <time datetime="${createdAt}">${escape(post.createdAt.toLocaleDateString('hi-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' }))}</time></p>${image ? `<img src="${escape(image)}" alt="${escape(post.title)}" fetchpriority="high">` : ''}<div class="article-content">${content}</div></article><a href="${this.site()}/">अन्य लेख पढ़ें</a></main>`;
    return {
      title,
      description,
      canonical,
      image,
      type: 'article',
      publishedTime: createdAt,
      modifiedTime: updatedAt,
      html,
      post: { ...post, content, analytics: [], createdAt, updatedAt },
      jsonLd: [
        this.publisher(),
        {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          '@id': `${canonical}#article`,
          url: canonical,
          headline: post.title,
          description,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          ...(image ? { image: [image] } : {}),
          datePublished: createdAt,
          dateModified: updatedAt,
          author,
          publisher: this.publisher(),
          inLanguage: 'hi-IN',
          articleSection: post.category?.name,
          keywords: post.tags.map((item) => item.tag.name),
          isAccessibleForFree: true,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'सौतुक',
              item: `${this.site()}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: post.title,
              item: canonical,
            },
          ],
        },
      ],
    };
  }
  async home() {
    const posts = await this.posts.findAll({ status: 'PUBLISHED', limit: 24 });
    return {
      title: 'सौतुक | राजनीति, अर्थशास्त्र, भू-राजनीति और जलवायु',
      description:
        'सौतुक पर राजनीति, अर्थशास्त्र, भू-राजनीति और जलवायु से जुड़े लेख और विश्लेषण पढ़ें।',
      canonical: `${this.site()}/`,
      image: `${this.site()}/sautuk-logo-icon.png`,
      type: 'website',
      html: `<header class="seo-brand"><a href="${this.site()}/">सौतुक</a></header><main class="seo-fallback"><h1>सौतुक — नवीनतम लेख</h1>${posts.map((post) => `<article><h2><a href="${escape(this.link(post.slug))}">${escape(post.title)}</a></h2><p>${escape(post.excerpt)}</p><time datetime="${post.createdAt.toISOString()}">${escape(post.createdAt.toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' }))}</time></article>`).join('')}<section id="author"><h2>लेखक</h2><p>कुंदन पांडेय</p></section></main>`,
      posts,
      jsonLd: [
        this.publisher(),
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'सौतुक',
          url: `${this.site()}/`,
          inLanguage: 'hi-IN',
          publisher: this.publisher(),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: posts.map((post, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: this.link(post.slug),
            name: post.title,
          })),
        },
      ],
    };
  }
  async sitemapIndex() {
    const count = await this.prisma.post.count({
      where: { status: 'PUBLISHED' },
    });
    const pages = Math.ceil(count / 1000);
    const urls = [
      `${this.site()}/sitemaps/pages.xml`,
      ...Array.from(
        { length: pages },
        (_, i) => `${this.site()}/sitemaps/articles-${i + 1}.xml`,
      ),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${escape(url)}</loc></sitemap>`).join('')}</sitemapindex>`;
  }
  sitemapPages() {
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${this.site()}/</loc></url></urlset>`;
  }
  async sitemapPage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Invalid sitemap page');
    const posts = await this.prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { slug: true, updatedAt: true },
      take: 1000,
      skip: (page - 1) * 1000,
    });
    if (!posts.length) throw new NotFoundException('Sitemap not found');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${posts.map((post) => `<url><loc>${escape(this.link(post.slug))}</loc><lastmod>${post.updatedAt.toISOString()}</lastmod></url>`).join('')}</urlset>`;
  }
  robots() {
    return `User-agent: *\nAllow: /\nDisallow: /sautuk-admin-gate\nDisallow: /api/\nSitemap: ${this.site()}/sitemap.xml\n`;
  }
  private latest(limit: number) {
    return this.prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        featuredImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async rss() {
    const posts = await this.latest(50);
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>सौतुक</title><link>${this.site()}/</link><description>सौतुक के नवीनतम लेख</description><language>hi-IN</language><atom:link href="${this.site()}/feed.xml" rel="self" type="application/rss+xml"/>${posts.map((post) => `<item><title>${escape(post.title)}</title><link>${escape(this.link(post.slug))}</link><guid isPermaLink="true">${escape(this.link(post.slug))}</guid><description>${escape(post.excerpt)}</description><pubDate>${post.createdAt.toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
  }
  async jsonFeed() {
    return {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'सौतुक',
      home_page_url: `${this.site()}/`,
      feed_url: `${this.site()}/feed.json`,
      language: 'hi-IN',
      items: (await this.latest(50)).map((post) => ({
        id: this.link(post.slug),
        url: this.link(post.slug),
        title: post.title,
        content_text: post.excerpt || post.title,
        date_published: post.createdAt.toISOString(),
        date_modified: post.updatedAt.toISOString(),
        ...(publicUrl(post.featuredImage)
          ? { image: publicUrl(post.featuredImage) }
          : {}),
      })),
    };
  }
  async llms() {
    const posts = await this.latest(100);
    return `# सौतुक / Sautuk Media\n\nHindi articles and analysis on politics, economics, geopolitics and climate.\n\nPublisher: Sautuk Media\nAuthor: कुंदन पांडेय\nLanguage: hi-IN\n\n## Discovery\n- Sitemap: ${this.site()}/sitemap.xml\n- RSS: ${this.site()}/feed.xml\n- JSON Feed: ${this.site()}/feed.json\n\n## Published articles\n${posts
      .map(
        (post) =>
          `- [${post.title
            .replaceAll('[', ' ')
            .replaceAll(']', ' ')
            .replace(
              /[\r\n]/g,
              ' ',
            )}](${this.link(post.slug)}): ${(post.excerpt || '').replace(/[\r\n]/g, ' ')}\n  Text: ${this.site()}/articles/${encodeURIComponent(post.slug)}`,
      )
      .join('\n')}\n`;
  }
  async text(slug: string) {
    const page = await this.article(slug);
    return {
      canonical: page.canonical,
      text: `# ${page.post.title}\n\nCanonical: ${page.canonical}\nAuthor: कुंदन पांडेय\nPublished: ${page.publishedTime}\nModified: ${page.modifiedTime}\n\n${articleText(page.post.content)}\n`,
    };
  }
}
