import type { Post, PostSummary } from '../services/types';

export interface SeoMetadata {
  title: string; description: string; canonical: string; image?: string; type: string;
  publishedTime?: string; modifiedTime?: string; jsonLd: unknown[];
  robots?: string;
}
export interface PublicPage extends SeoMetadata { html: string; post?: Post; posts?: PostSummary[] }
export const SITE_URL = 'https://sautuk.com';
export const HOME_METADATA: SeoMetadata = {
  title: 'सौतुक | राजनीति, अर्थशास्त्र, भू-राजनीति और जलवायु',
  description: 'सौतुक पर राजनीति, अर्थशास्त्र, भू-राजनीति और जलवायु से जुड़े लेख और विश्लेषण पढ़ें।',
  canonical: `${SITE_URL}/`, image: `${SITE_URL}/sautuk-logo-icon.png`, type: 'website',
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'सौतुक', url: `${SITE_URL}/`, inLanguage: 'hi-IN', publisher: { '@type': 'Organization', name: 'Sautuk Media', url: `${SITE_URL}/` } }],
};
export const ADMIN_METADATA: SeoMetadata = { ...HOME_METADATA, title: 'संपादकीय कक्ष | सौतुक', canonical: `${SITE_URL}/sautuk-admin-gate`, robots: 'noindex,nofollow', jsonLd: [] };
export const NOT_FOUND_METADATA: SeoMetadata = { ...HOME_METADATA, title: 'पृष्ठ उपलब्ध नहीं है | सौतुक', robots: 'noindex,follow', jsonLd: [] };
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const jsonForHtml = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export function articleMetadata(post: Post): SeoMetadata {
  const canonical = `${SITE_URL}/posts/${encodeURIComponent(post.slug)}`;
  const description = post.seoDescription?.trim() || post.excerpt || post.title;
  return {
    title: post.seoTitle?.trim() || `${post.title} | सौतुक`, description, canonical,
    type: 'article', image: post.featuredImage || undefined, publishedTime: post.createdAt, modifiedTime: post.updatedAt, ...(post.status === 'DRAFT' ? { robots: 'noindex,nofollow' } : {}),
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', '@id': `${canonical}#article`, headline: post.title, description, mainEntityOfPage: canonical, url: canonical,
      datePublished: post.createdAt, dateModified: post.updatedAt, inLanguage: 'hi-IN', isAccessibleForFree: true,
      author: { '@type': 'Person', name: 'कुंदन पांडेय' }, publisher: { '@type': 'Organization', name: 'Sautuk Media', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/sautuk-logo-icon.png` } },
      ...(post.featuredImage ? { image: [post.featuredImage] } : {}), articleSection: post.category?.name,
    }],
  };
}
export function metaEntries(page: SeoMetadata): Array<{ name?: string; property?: string; content: string }> {
  return [
    { name: 'description', content: page.description },
    { name: 'robots', content: page.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' },
    { property: 'og:title', content: page.title }, { property: 'og:description', content: page.description },
    { property: 'og:url', content: page.canonical }, { property: 'og:type', content: page.type },
    { property: 'og:site_name', content: 'सौतुक' }, { property: 'og:locale', content: 'hi_IN' },
    { name: 'twitter:card', content: page.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: page.title }, { name: 'twitter:description', content: page.description },
    ...(page.image ? [{ property: 'og:image', content: page.image }, { property: 'og:image:alt', content: page.title }, { name: 'twitter:image', content: page.image }] : []),
    ...(page.publishedTime ? [{ property: 'article:published_time', content: page.publishedTime }] : []),
    ...(page.modifiedTime ? [{ property: 'article:modified_time', content: page.modifiedTime }] : []),
  ];
}
export function renderHead(page: SeoMetadata): string {
  return `<title>${escapeHtml(page.title)}</title>${metaEntries(page).map(entry => `<meta ${entry.name ? `name="${entry.name}"` : `property="${entry.property}"`} content="${escapeHtml(entry.content)}" data-sautuk-seo>`).join('')}<link rel="canonical" href="${escapeHtml(page.canonical)}" data-sautuk-seo><link rel="alternate" type="application/rss+xml" title="सौतुक RSS" href="${SITE_URL}/feed.xml"><link rel="alternate" type="application/feed+json" title="सौतुक JSON Feed" href="${SITE_URL}/feed.json"><script id="sautuk-jsonld" type="application/ld+json">${jsonForHtml(page.jsonLd)}</script>`;
}
export function renderPublicPage(shell: string, page: PublicPage): string {
  const cleaned = shell.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, '');
  return cleaned.replace('</head>', `${renderHead(page)}<style>.seo-brand,.seo-fallback{max-width:54rem;margin:auto;padding:1.5rem}.seo-brand a{font-size:2rem;font-weight:bold}.seo-fallback h1{font-size:2.25rem;line-height:1.6}.seo-fallback p{line-height:1.9}.seo-fallback article{margin-bottom:2rem}.seo-fallback img{max-width:100%;height:auto;border-radius:.5rem}</style></head>`)
    .replace(/<div id="root">\s*<\/div>/, `<div id="root">${page.html}</div><script id="sautuk-page-data" type="application/json">${jsonForHtml({ ...page, html: undefined })}</script>`);
}
