import { Parser } from 'htmlparser2';

export const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
export function publicUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function sanitizeArticle(source: string): string {
  const allowed = new Set([
    'p',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    's',
    'del',
    'u',
    'sup',
    'sub',
    'blockquote',
    'ul',
    'ol',
    'li',
    'pre',
    'code',
    'a',
    'br',
    'hr',
    'img',
    'figure',
    'figcaption',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ]);
  const hidden = new Set([
    'script',
    'style',
    'iframe',
    'object',
    'template',
    'svg',
    'math',
    'noscript',
  ]);
  const voids = new Set(['img', 'br', 'hr']);
  let depth = 0;
  const chunks: string[] = [];
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        if (hidden.has(tag)) depth++;
        if (depth || !allowed.has(tag)) return;
        const safe: Record<string, string> = {};
        if (tag === 'a' && publicUrl(attrs.href)) {
          safe.href = publicUrl(attrs.href);
          safe.rel = 'noopener noreferrer';
        }
        if (tag === 'img') {
          safe.src = publicUrl(attrs.src);
          safe.alt = attrs.alt || '';
          safe.loading = 'lazy';
          safe.decoding = 'async';
          if (/^\d{1,4}$/.test(attrs.width || '')) safe.width = attrs.width;
          if (/^\d{1,4}$/.test(attrs.height || '')) safe.height = attrs.height;
        }
        if (tag === 'figure' && 'data-article-figure' in attrs) {
          safe['data-article-figure'] = '';
          safe['data-placement'] = ['left', 'right'].includes(
            attrs['data-placement'],
          )
            ? attrs['data-placement']
            : 'full';
          safe['data-width'] = String(
            Math.max(25, Math.min(100, Number(attrs['data-width']) || 100)),
          );
          safe.style = `--figure-width:${safe['data-width']}%`;
        }
        if (tag === 'span') {
          if ('data-caption' in attrs) safe['data-caption'] = '';
          if ('data-credit' in attrs) safe['data-credit'] = '';
          if (attrs.class === 'figure-number') safe.class = 'figure-number';
        }
        chunks.push(
          `<${tag}${Object.entries(safe)
            .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
            .join('')}>`,
        );
      },
      ontext(text) {
        if (!depth) chunks.push(escapeHtml(text));
      },
      onclosetag(tag) {
        if (hidden.has(tag)) {
          depth = Math.max(0, depth - 1);
          return;
        }
        if (!depth && allowed.has(tag) && !voids.has(tag))
          chunks.push(`</${tag}>`);
      },
    },
    { decodeEntities: true },
  );
  parser.end(source);
  return chunks.join('');
}

export function articleText(html: string): string {
  const chunks: string[] = [];
  const links = new Set<string>();
  const parser = new Parser(
    {
      ontext: (text) => {
        chunks.push(text);
      },
      onopentag(tag, attrs) {
        if (tag === 'img' && attrs.alt) chunks.push(`\n[${attrs.alt}]\n`);
        if (tag === 'a' && publicUrl(attrs.href))
          links.add(publicUrl(attrs.href));
        if (['p', 'h2', 'h3', 'li', 'figcaption', 'br'].includes(tag))
          chunks.push('\n');
      },
      onclosetag(tag) {
        if (['p', 'h2', 'h3', 'li', 'figcaption'].includes(tag))
          chunks.push('\n');
      },
    },
    { decodeEntities: true },
  );
  parser.end(sanitizeArticle(html));
  return (
    chunks
      .join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() +
    (links.size ? `\n\nसंदर्भ / References\n${[...links].join('\n')}` : '')
  );
}
