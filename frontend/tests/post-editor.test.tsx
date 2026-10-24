import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostEditor from '../src/pages/admin/PostEditor';
import { apiFetch } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/components/TiptapEditor', () => ({ default: () => <div>Editor</div> }));
vi.mock('mammoth', () => ({ default: {} }));

const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
const writes = () => vi.mocked(apiFetch).mock.calls.filter(([, options]) => options?.method === 'POST' || options?.method === 'PATCH');
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function openEditor(postId: string | null = null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PostEditor postId={postId} onClose={onClose} /></QueryClientProvider>);
}

describe('editor autosave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async () => response([]));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('keeps a failed draft save retryable without requiring another edit', async () => {
    let attempts = 0;
    vi.mocked(apiFetch).mockImplementation(async (_path, options) => {
      if (options?.method === 'POST' || options?.method === 'PATCH') {
        attempts++;
        return attempts === 1 ? response({ message: 'Offline' }, false) : response({ id: 'saved-draft' });
      }
      return response([]);
    });
    openEditor();
    await advance(1);
    fireEvent.change(screen.getByPlaceholderText(/उदा\. उप-सहारन/), { target: { value: 'Unsaved draft' } });
    await advance(3100);
    expect(writes()).toHaveLength(1);
    expect(screen.queryByText('मसौदा स्वतः सहेजा गया')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'फिर से सहेजें' }));
    await advance(100);
    expect(writes()).toHaveLength(2);
    expect(JSON.parse(writes()[1][1]!.body as string).title).toBe('Unsaved draft');
    expect(screen.getByText('मसौदा स्वतः सहेजा गया')).toBeTruthy();
  });

  it('saves edits typed while a previous snapshot is still in flight', async () => {
    let finishFirst!: (value: Response) => void;
    vi.mocked(apiFetch).mockImplementation(async (_path, options) => {
      if (options?.method === 'POST' || options?.method === 'PATCH') {
        if (writes().length === 1) return new Promise<Response>(resolve => { finishFirst = resolve; });
        return response({ id: 'saved-draft' });
      }
      return response([]);
    });
    openEditor();
    await advance(1);
    const title = screen.getByPlaceholderText(/उदा\. उप-सहारन/);
    fireEvent.change(title, { target: { value: 'First snapshot' } });
    await advance(3100);
    fireEvent.change(title, { target: { value: 'Newer unsaved text' } });
    await advance(3100);
    expect(writes()).toHaveLength(1);
    await act(async () => finishFirst(response({ id: 'saved-draft' })));
    await advance(3200);
    expect(writes()).toHaveLength(2);
    expect(JSON.parse(writes()[1][1]!.body as string).title).toBe('Newer unsaved text');
  });

  it('keeps published edits local until an explicit publish confirmation', async () => {
    let liveTitle = 'Live article';
    vi.mocked(apiFetch).mockImplementation(async (path, options) => {
      if (options?.method === 'PATCH') {
        liveTitle = JSON.parse(options.body as string).title;
        return response({ id: 'published', title: liveTitle });
      }
      if (path === '/posts/published') return response({ id: 'published', title: liveTitle, slug: 'live', content: '<p>Live</p>', excerpt: 'Live excerpt', status: 'PUBLISHED', categoryId: 'cat', featuredImage: 'https://example.test/image.jpg', tags: [] });
      return response([]);
    });
    openEditor('published');
    await advance(100);
    fireEvent.change(screen.getByPlaceholderText(/उदा\. उप-सहारन/), { target: { value: 'Edited article' } });
    await advance(4000);
    expect(writes()).toHaveLength(0);
    expect(liveTitle).toBe('Live article');
    expect(screen.getByText(/संपादन जारी/)).toBeTruthy();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    cleanup();
    openEditor('published');
    await advance(100);
    expect((screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement).value).toBe('Edited article');
    fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'रद्द करें (Cancel)' }));
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
    fireEvent.click(screen.getByRole('button', { name: 'हाँ, बदलाव लाइव करें' }));
    await advance(100);
    expect(writes()).toHaveLength(1);
    expect(liveTitle).toBe('Edited article');
    expect(localStorage.getItem('sautuk:editing:published')).toBeNull();
  });

  it('asks before leaving an editor with changes that have not been saved', async () => {
    const onClose = vi.fn();
    openEditor(null, onClose);
    await advance(1);
    fireEvent.change(screen.getByPlaceholderText(/उदा\. उप-सहारन/), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'रद्द करें', exact: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'हाँ, बाहर जाएँ' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(writes()).toHaveLength(0);
  });
});
