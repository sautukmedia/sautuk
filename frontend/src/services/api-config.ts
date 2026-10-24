export function resolveApiUrl(value: string | undefined, production: boolean): string {
  const configured = value?.trim().replace(/\/+$/, '');
  if (!configured) {
    if (production) throw new Error('Set VITE_API_URL to the production HTTPS API URL (or a same-origin /api proxy) before building.');
    return 'http://localhost:3000';
  }
  if (/^\/(?!\/)[\w/-]+$/.test(configured)) return configured;
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error('VITE_API_URL must be an absolute API URL or same-origin proxy path.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL contains an invalid scheme, credentials, query or fragment.');
  }
  if (production && (url.protocol !== 'https:' || /^(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/.test(url.hostname))) {
    throw new Error('Production VITE_API_URL must use HTTPS and a public API hostname.');
  }
  return configured;
}

export function apiRequestUrl(path: string, value: string | undefined, production: boolean): string {
  const upstream = resolveApiUrl(value, production);
  // Keep only cookie-based authentication first-party; large uploads stay direct to CloudFront.
  const base = production && path.startsWith('/auth/') && !upstream.startsWith('/') ? '/api' : upstream;
  return `${base}${path}`;
}

export function netlifyApiRedirects(value: string): string {
  const upstream = resolveApiUrl(value, true);
  const auth = upstream.startsWith('/') ? '' : `/api/auth/* ${upstream}/auth/:splat 200!\n`;
  return `${auth}/* /index.html 200\n`;
}
