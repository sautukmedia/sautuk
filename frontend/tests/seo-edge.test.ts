import { afterEach, expect, it, vi } from 'vitest';
import seo from '../netlify/edge-functions/seo';
import { HOME_METADATA, renderPublicPage } from '../src/seo/metadata';
import type { Context } from '@netlify/edge-functions';
const shell = '<html lang="hi"><head><title>Old title</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
afterEach(() => { vi.unstubAllGlobals(); });
function setup(response: Response) {
  vi.stubGlobal('Netlify', { env: { get: () => 'https://api.example.test' } });
  const fetcher = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, context: { next: async () => new Response(shell, { headers: { 'content-type': 'text/html', 'content-length': '10' } }) } as unknown as Context };
}
it('renders crawlable content and escapes metadata/JSON without creating executable scripts', () => {
  const html = renderPublicPage(shell, { ...HOME_METADATA, title: 'Story </title><script>bad()</script>', html: '<main><h1>Readable story</h1><p>Body</p></main>', jsonLd: [{ headline: '</script><script>bad()</script>' }] });
  expect(html).toContain('<h1>Readable story</h1>');
  expect(html).toContain('rel="canonical"');
  expect(html).not.toContain('<script>bad()');
  expect(html).toContain('\\u003c/script>');
});
it('never forwards viewer credentials when fetching public HTML and responds 404 to unpublished articles', async () => {
  const { context, fetcher } = setup(new Response('{}', { status: 404 }));
  const response = await seo(new Request('https://sautuk.com/posts/draft', { headers: { authorization: 'Bearer private', cookie: 'secret=private' } }), context);
  expect(response.status).toBe(404);
  expect(response.headers.get('x-robots-tag')).toBe('noindex');
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain('private');
});
it('returns a retryable 503 when the upstream response is malformed', async () => {
  const { context } = setup(new Response('not-json'));
  const response = await seo(new Request('https://sautuk.com/posts/test'), context);
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('60');
});
it('returns the rendered article for ordinary browsers and crawlers alike', async () => {
  const { context } = setup(new Response(JSON.stringify({ ...HOME_METADATA, html: '<main>Article visible without JavaScript</main>' })));
  const response = await seo(new Request('https://sautuk.com/'), context);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-length')).toBeNull();
  expect(await response.text()).toContain('Article visible without JavaScript');
});
it('blocks indexing of preview sites and returns real 404s for unknown routes', async () => {
  const { context } = setup(new Response('{}'));
  const robots = await seo(new Request('https://preview.netlify.app/robots.txt'), context);
  expect(await robots.text()).toContain('Disallow: /');
  const missing = await seo(new Request('https://sautuk.com/missing-page'), context);
  expect(missing.status).toBe(404);
  expect(await missing.text()).toContain('मुख्य पृष्ठ');
});
