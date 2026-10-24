import type { QueryClient } from '@tanstack/react-query';
import type { PublicPage } from './metadata';

export function seedPublicPage(client: QueryClient, document: Document) {
  try {
    const source = document.getElementById('sautuk-page-data')?.textContent;
    if (!source) return;
    const page = JSON.parse(source) as PublicPage;
    if (page.post?.status === 'PUBLISHED' && typeof page.post.slug === 'string') client.setQueryData(['post', page.post.slug], page.post);
    if (Array.isArray(page.posts) && page.posts.every(post => post.status === 'PUBLISHED')) {
      client.setQueryData(['posts', undefined, ''], { pages: [page.posts], pageParams: [1] });
    }
  } catch { /* Invalid bootstrap data falls back to ordinary API loading. */ }
}
