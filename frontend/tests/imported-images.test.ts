import { afterEach, expect, it, vi } from 'vitest';
import { uploadImportedImages } from '../src/services/imported-images';
import { apiFetch } from '../src/services/api';
vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
const source = '<p>Original article</p><img src="data:image/jpeg;base64,eA=="><img src="data:image/jpeg;base64,eA==">';
it('refuses to replace an article when an embedded image upload fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
  vi.mocked(apiFetch).mockResolvedValue(new Response('{}', { status: 503 }));
  await expect(uploadImportedImages(source)).rejects.toThrow();
});
it('uploads duplicate embedded images once using the correct file extension', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
  vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ url: 'https://cdn.example/imported.jpg' })));
  const html = await uploadImportedImages(source);
  expect(html).not.toContain('data:');
  expect((html.match(/https:\/\/cdn.example\/imported.jpg/g) || []).length).toBe(2);
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect((vi.mocked(apiFetch).mock.calls[0][1]?.body as FormData).get('file')).toMatchObject({ name: 'word-image.jpg' });
});
