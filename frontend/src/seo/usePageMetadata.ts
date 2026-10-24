import { useEffect } from 'react';
import { jsonForHtml, metaEntries, type SeoMetadata } from './metadata';

export function usePageMetadata(page: SeoMetadata | null) {
  useEffect(() => {
    if (!page) return;
    document.title = page.title;
    document.head.querySelectorAll('[data-sautuk-seo], meta[name="description"]').forEach(element => element.remove());
    for (const entry of metaEntries(page)) {
      const meta = document.createElement('meta');
      if (entry.name) meta.name = entry.name;
      if (entry.property) meta.setAttribute('property', entry.property);
      meta.content = entry.content; meta.setAttribute('data-sautuk-seo', ''); document.head.append(meta);
    }
    const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = page.canonical;
    canonical.setAttribute('data-sautuk-seo', ''); document.head.append(canonical);
    let structured = document.getElementById('sautuk-jsonld');
    if (!structured) { structured = document.createElement('script'); structured.id = 'sautuk-jsonld'; structured.setAttribute('type', 'application/ld+json'); document.head.append(structured); }
    structured.textContent = jsonForHtml(page.jsonLd);
  }, [page]);
}
