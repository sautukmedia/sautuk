import { apiFetch } from './api';

// Finish every upload before replacing the editor document; a partial import must not erase images.
export async function uploadImportedImages(html: string): Promise<string> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const uploaded = new Map<string, string>();
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
  for (const image of document.querySelectorAll('img')) {
    const source = image.getAttribute('src') || '';
    if (!source.startsWith('data:')) continue;
    let url = uploaded.get(source);
    if (!url) {
      if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(source)) throw new Error('Unsupported document image');
      const response = await fetch(source);
      const blob = await response.blob();
      if (!extensions[blob.type] || blob.size > 10 * 1024 * 1024) throw new Error('Unsupported or oversized document image');
      const body = new FormData();
      body.append('file', blob, `word-image.${extensions[blob.type]}`);
      const result = await apiFetch('/media/upload', { method: 'POST', body });
      if (!result.ok) throw new Error('Document image upload failed; original article retained');
      const data = await result.json();
      if (typeof data.url !== 'string' || !/^https?:\/\//i.test(data.url)) throw new Error('Invalid uploaded image URL');
      url = data.url as string;
      uploaded.set(source, url);
    }
    image.setAttribute('src', url);
  }
  return document.body.innerHTML;
}
