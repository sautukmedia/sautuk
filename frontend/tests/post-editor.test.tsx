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
describe('isolated production review probes', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const livePost = { id: 'published', title: 'Live article', slug: 'live', content: '<p>Live</p>', excerpt: 'Live excerpt', status: 'PUBLISHED', categoryId: 'cat', featuredImage: 'https://example.test/image.jpg', tags: [] };
  it('reproduces closing the editor with newer input absent from the confirmed PATCH', async () => {
    let finish!: (value: Response) => void;
    vi.mocked(apiFetch).mockImplementation(async (path, options) => {
      if (options?.method === 'PATCH') return new Promise<Response>(resolve => { finish = resolve; });
      return response(path === '/posts/published' ? livePost : []);
    });
    const onClose = vi.fn();
    openEditor('published', onClose);
    await advance(100);
    const title = screen.getByPlaceholderText(/उदा\. उप-सहारन/);
    fireEvent.change(title, { target: { value: 'Confirmed version' } });
    fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
    fireEvent.click(screen.getByRole('button', { name: 'हाँ, बदलाव लाइव करें' }));
    await advance(100);
    fireEvent.change(title, { target: { value: 'Newer unsaved version' } });
    await advance(100);
    expect(localStorage.getItem('sautuk:editing:published')).toContain('Newer unsaved version');
    await act(async () => finish(response({ ...livePost, title: 'Confirmed version' })));
    await advance(100);
    expect(JSON.parse(writes()[0][1]!.body as string).title).toBe('Confirmed version');
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement).value).toBe('Newer unsaved version');
  });
});

describe('existing article load failures', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it.each([401, 404, 503])('blocks editing after HTTP %s and allows retrying the same article', async (status) => {
    let failed = true;
    vi.mocked(apiFetch).mockImplementation(async path => {
      if (path !== '/posts/broken') return response([]);
      if (failed) return { ...response({ message: 'Article could not be loaded' }, false), status } as Response;
      return response({ id: 'broken', title: 'Recovered article', slug: 'recovered', content: '<p>Recovered content</p>', excerpt: 'Recovered', status: 'DRAFT', tags: [] });
    });
    openEditor('broken');
    await advance(100);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/उदा\. उप-सहारन/)).toBeNull();
    expect(writes()).toHaveLength(0);

    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'फिर से प्रयास करें' }));
    await advance(100);
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement).value).toBe('Recovered article');
  });

  it('blocks the blank form when the article request fails at the network layer', async () => {
    vi.mocked(apiFetch).mockImplementation(async path => {
      if (path === '/posts/broken') throw new Error('Network unavailable');
      return response([]);
    });
    openEditor('broken');
    await advance(100);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/उदा\. उप-सहारन/)).toBeNull();
    expect(writes()).toHaveLength(0);
  });
});

describe('unavailable editor taxonomy', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it.each(['/categories', '/tags'])('keeps the editor usable when %s returns error JSON', async endpoint => {
    vi.mocked(apiFetch).mockImplementation(async path => path === endpoint ? response({message:'Unavailable'}, false) : response([]));
    openEditor();
    await advance(100);
    expect(screen.getByPlaceholderText(/उदा\. उप-सहारन/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('श्रेणियाँ या टैग');
    fireEvent.click(screen.getByRole('button', {name:'श्रेणियाँ और टैग फिर लोड करें'}));
    await advance(100);
  });
});
