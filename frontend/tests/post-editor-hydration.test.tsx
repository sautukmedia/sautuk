import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import PostEditor from '../src/pages/admin/PostEditor';
import { apiFetch } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/components/TiptapEditor', () => ({ default: () => <div>Editor</div> }));
vi.mock('mammoth', () => ({ default: {} }));

const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const cachedPost = {
  id: 'story', title: 'Cached story', slug: 'story', content: '<p>Cached body</p>',
  excerpt: 'Cached excerpt', status: 'DRAFT', tags: [], updatedAt: '2026-10-24T12:00:00.001Z',
};

afterEach(() => { cleanup(); localStorage.clear(); });

it('starts with empty fields when switching an existing article to a new draft', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(apiFetch).mockImplementation(async path => path === '/posts/story' ? response(cachedPost) : response([]));
  const view = (postId: string | null) => <QueryClientProvider client={client}><PostEditor postId={postId} onClose={vi.fn()} /></QueryClientProvider>;
  const rendered = render(view('story'));
  const title = await screen.findByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement;
  expect(title.value).toBe('Cached story');
  rendered.rerender(view(null));
  expect((screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement).value).toBe('');
});

it('blocks editing a cached existing article until this editor has hydrated the fresh response', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['admin-post-edit', 'story'], cachedPost);
  let finish!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path === '/posts/story') return new Promise<Response>(resolve => { finish = resolve; });
    return response([]);
  });
  render(<QueryClientProvider client={client}><PostEditor postId="story" onClose={vi.fn()} /></QueryClientProvider>);
  await act(async () => {});

  const pendingTitle = screen.queryByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement | null;
  expect(pendingTitle === null || pendingTitle.disabled).toBe(true);
  expect(Array.from(document.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).every(button => button.disabled)).toBe(true);

  await act(async () => finish(response({ ...cachedPost, title: 'Fresh server story', updatedAt: '2026-10-24T12:00:00.002Z' })));
  const title = screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement;
  expect(title.value).toBe('Fresh server story');
  expect(title.disabled).toBe(false);
});
