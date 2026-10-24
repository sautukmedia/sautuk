import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import FigureMediaPicker from '../src/components/editor/FigureMediaPicker';
import { apiFetch } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function mount(onSelect = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(<QueryClientProvider client={client}><FigureMediaPicker onSelect={onSelect} onClose={vi.fn()} /></QueryClientProvider>);
  return { ...result, onSelect };
}
it('selects an existing upload and filters paginated searches through the backend', async () => {
  vi.mocked(apiFetch).mockImplementation(async () => new Response(JSON.stringify({ items: [{ id: '1', filename: 'news.jpg', url: 'https://cdn.example/news.jpg' }], nextCursor: 'page2' })));
  const { onSelect } = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'news.jpg' }));
  expect(onSelect).toHaveBeenCalledWith('https://cdn.example/news.jpg', 'news.jpg');
  fireEvent.change(screen.getByLabelText('फ़ाइल नाम से चित्र खोजें'), { target: { value: 'news' } });
  fireEvent.click(screen.getByRole('button', { name: 'खोजें' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/media?limit=24&search=news', expect.any(Object)));
});
it('rejects oversized images without uploading and exposes a retry for library failures', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
  const { onSelect } = mount();
  await screen.findByText('मीडिया संग्रह लोड नहीं हुआ।');
  const file = new File(['x'], 'large.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText('नया चित्र अपलोड करें'), { target: { files: [file] } });
  expect(screen.getByText(/अधिकतम 10 MB/)).toBeTruthy();
  expect(onSelect).not.toHaveBeenCalled();
  expect(apiFetch).toHaveBeenCalledTimes(1);
});
it('cancels a pending upload when closed and never inserts its late response', async () => {
  let resolveUpload!: (response: Response) => void;
  vi.mocked(apiFetch).mockImplementation(async (path) => path === '/media/upload'
    ? new Promise<Response>(resolve => { resolveUpload = resolve; })
    : new Response(JSON.stringify({ items: [], nextCursor: null })));
  const { onSelect, unmount } = mount();
  fireEvent.change(screen.getByLabelText('नया चित्र अपलोड करें'), { target: { files: [new File(['x'], 'new.png', { type: 'image/png' })] } });
  const request = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/media/upload');
  unmount();
  expect(request?.[1]?.signal?.aborted).toBe(true);
  resolveUpload(new Response(JSON.stringify({ url: 'https://cdn.example/new.png' })));
  await Promise.resolve();
  expect(onSelect).not.toHaveBeenCalled();
});
