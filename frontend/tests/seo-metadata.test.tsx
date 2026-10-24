import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it } from 'vitest';
import { HOME_METADATA, articleMetadata, type SeoMetadata } from '../src/seo/metadata';
import { usePageMetadata } from '../src/seo/usePageMetadata';
import { seedPublicPage } from '../src/seo/bootstrap';
import type { Post } from '../src/services/types';
afterEach(() => { cleanup(); document.head.innerHTML = ''; });
function Page({ metadata }: { metadata: SeoMetadata }) { usePageMetadata(metadata); return <main>Page</main>; }
it('replaces article metadata on client navigation without duplicate canonical links', () => {
  document.head.innerHTML = '<meta name="description" content="Generic shell description">';
  const post = { slug: 'हिंदी', title: 'Headline', excerpt: 'Summary', content: '<p>Body</p>', createdAt: '2026-01-01', updatedAt: '2026-02-01', status: 'PUBLISHED', seoTitle: 'Custom SEO title', seoDescription: 'Custom description' } as Post;
  const view = render(<Page metadata={articleMetadata(post)} />);
  expect(document.title).toBe('Custom SEO title');
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Custom description');
  view.rerender(<Page metadata={HOME_METADATA} />);
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.head.querySelector('meta[property="article:published_time"]')).toBeNull();
  expect(document.title).toBe(HOME_METADATA.title);
});
it('hydrates only public page data so readers do not wait for an empty article shell', () => {
  const document = new DOMParser().parseFromString('<script id="sautuk-page-data" type="application/json">{"post":{"status":"DRAFT","slug":"secret"}}</script>', 'text/html');
  const client = new QueryClient();
  seedPublicPage(client, document);
  expect(client.getQueryData(['post', 'secret'])).toBeUndefined();
  document.getElementById('sautuk-page-data')!.textContent = '{"post":{"status":"PUBLISHED","slug":"public","title":"Public story"}}';
  seedPublicPage(client, document);
  expect(client.getQueryData(['post', 'public'])).toMatchObject({ title: 'Public story' });
});
