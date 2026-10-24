import type { Config, Context } from '@netlify/edge-functions';
import { renderPublicPage, type PublicPage } from '../../src/seo/metadata.ts';

function apiBase() {
  const configured = Netlify.env.get('API_BASE_URL') || Netlify.env.get('VITE_API_URL');
  return configured && /^https?:\/\//.test(configured) ? configured.replace(/\/+$/, '') : 'https://d2wr930tmjgeyn.cloudfront.net';
}
export default async function seo(request: Request, context: Context): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return context.next();
  const url = new URL(request.url);
  const preview = !['sautuk.com', 'www.sautuk.com'].includes(url.hostname);
  if (url.pathname === '/robots.txt' && preview) return new Response(request.method === 'HEAD' ? null : 'User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  if (url.pathname === '/sautuk-admin-gate') {
    const response = await context.next(); const headers = new Headers(response.headers);
    headers.set('x-robots-tag', 'noindex, nofollow'); headers.set('cache-control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  }
  const plainPaths: Record<string, string> = { '/robots.txt': '/seo/robots.txt', '/sitemap.xml': '/seo/sitemap.xml', '/feed.xml': '/seo/feed.xml', '/feed.json': '/seo/feed.json', '/llms.txt': '/seo/llms.txt' };
  const backendPath = plainPaths[url.pathname] || (url.pathname.startsWith('/sitemaps/') ? `/seo${url.pathname}` : url.pathname.startsWith('/articles/') ? `/seo/article-text/${url.pathname.slice('/articles/'.length)}` : null);
  if (backendPath) {
    try {
      const response = await fetch(`${apiBase()}${backendPath}`, { signal: AbortSignal.timeout(8000), headers: { accept: '*/*' } });
      const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('content-encoding');
      headers.set('cache-control', 'no-store');
      if (preview) headers.set('x-robots-tag', 'noindex, nofollow');
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
    } catch { return new Response('Service temporarily unavailable', { status: 503, headers: { 'retry-after': '60' } }); }
  }
  const article = url.pathname.startsWith('/posts/');
  if (url.pathname !== '/' && !article) {
    const shell = await context.next();
    const headers = new Headers(shell.headers); headers.delete('content-length'); headers.delete('content-encoding'); headers.delete('etag');
    headers.set('x-robots-tag', 'noindex'); headers.set('cache-control', 'no-store');
    const html = (await shell.text()).replace(/<div id="root">\s*<\/div>/, '<div id="root"><main><h1>पृष्ठ उपलब्ध नहीं है</h1><a href="/">मुख्य पृष्ठ</a></main></div>');
    return new Response(request.method === 'HEAD' ? null : html, { status: 404, headers });
  }
  const path = article ? `/seo/articles/${url.pathname.slice('/posts/'.length)}` : '/seo/home';
  const shellRequest = context.next();
  let savedShell: string | undefined;
  try {
    // Only public data is requested: never forward a viewer's cookies or authorization.
    const [shell, response] = await Promise.all([shellRequest, fetch(`${apiBase()}${path}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })]);
    const shellHtml = await shell.text();
    savedShell = shellHtml;
    const headers = new Headers(shell.headers);
    for (const name of ['content-length', 'content-encoding', 'etag']) headers.delete(name);
    headers.set('content-type', 'text/html; charset=utf-8'); headers.set('cache-control', 'no-store');
    if (!response.ok) {
      const status = response.status === 404 && article ? 404 : 503;
      headers.set('x-robots-tag', 'noindex');
      if (status === 503) headers.set('retry-after', '60');
      const message = status === 404 ? 'यह लेख उपलब्ध नहीं है।' : 'लेख अभी लोड नहीं हुआ। कृपया फिर से प्रयास करें।';
      const html = shellHtml.replace(/<div id="root">\s*<\/div>/, `<div id="root"><main class="seo-fallback"><h1>${message}</h1><a href="/">मुख्य पृष्ठ</a></main></div>`);
      return new Response(request.method === 'HEAD' ? null : html, { status, headers });
    }
    const page = await response.json() as PublicPage;
    if (typeof page.html !== 'string' || typeof page.title !== 'string' || !Array.isArray(page.jsonLd)) throw new Error('Invalid public page payload');
    if (new URL(page.canonical).hostname !== url.hostname) headers.set('x-robots-tag', 'noindex, nofollow');
    headers.set('link', `<${page.canonical}>; rel="canonical"`);
    return new Response(request.method === 'HEAD' ? null : renderPublicPage(shellHtml, page), { status: 200, headers });
  } catch {
    const shell = await shellRequest;
    const headers = new Headers(shell.headers); headers.delete('content-length'); headers.delete('content-encoding');
    headers.set('retry-after', '60'); headers.set('x-robots-tag', 'noindex'); headers.set('cache-control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : savedShell ?? await shell.text(), { status: 503, headers });
  }
}
export const config: Config = { path: '/*', excludedPath: ['/assets/*', '/api/*', '/.well-known/*', '/*.svg', '/*.png', '/*.jpg', '/*.jpeg', '/*.webp', '/*.gif', '/*.ico', '/*.css', '/*.js'] };
