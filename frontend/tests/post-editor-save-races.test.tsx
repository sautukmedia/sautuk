import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PostEditor from '../src/pages/admin/PostEditor';
import { apiFetch } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/components/TiptapEditor', () => ({ default: () => <div>Editor</div> }));
vi.mock('mammoth', () => ({ default: {} }));

const oldVersion = '2026-10-24T12:00:00.001Z';
const savedVersion = '2026-10-24T12:00:00.002Z';
const basePost = {
  id: 'existing', title: 'Original article', slug: 'existing', content: '<p>Article body</p>',
  excerpt: 'Article excerpt', categoryId: 'category', featuredImage: 'https://example.test/cover.jpg',
  tags: [], featured: false, updatedAt: oldVersion,
};
const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const writes = () => vi.mocked(apiFetch).mock.calls.filter(([, options]) => options?.method === 'PATCH' || options?.method === 'POST');
async function advance(ms = 100) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function openEditor(onClose: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><PostEditor postId="existing" onClose={onClose} /></QueryClientProvider>);
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

it('resumes draft autosave after a manual save completes with newer unsaved input', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') {
      if (writes().length === 1) return new Promise<Response>(resolve => { finish = resolve; });
      return response({ ...basePost, status: 'DRAFT', updatedAt: '2026-10-24T12:00:00.003Z' });
    }
    return response(path === '/posts/existing' ? { ...basePost, status: 'DRAFT' } : []);
  });
  const onClose = vi.fn();
  openEditor(onClose);
  await advance();
  const title = screen.getByPlaceholderText(/उदा\. उप-सहारन/);
  fireEvent.change(title, { target: { value: 'Manual save snapshot' } });
  fireEvent.click(screen.getByRole('button', { name: 'प्रकाशित करें' }));
  await advance();
  expect(writes()).toHaveLength(1);
  fireEvent.change(title, { target: { value: 'New input during manual save' } });
  await advance(3500);
  expect(writes()).toHaveLength(1);
  await act(async () => finish(response({ ...basePost, status: 'DRAFT', title: 'Manual save snapshot', updatedAt: savedVersion })));
  await advance(3500);
  expect(onClose).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(2);
  expect(JSON.parse(writes()[1][1]!.body as string)).toMatchObject({
    title: 'New input during manual save', expectedUpdatedAt: savedVersion, status: 'DRAFT',
  });
});

it('rebases the preserved published working copy onto the version returned by a completed save', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return new Promise<Response>(resolve => { finish = resolve; });
    return response(path === '/posts/existing' ? { ...basePost, status: 'PUBLISHED' } : []);
  });
  const onClose = vi.fn();
  openEditor(onClose);
  await advance();
  const title = screen.getByPlaceholderText(/उदा\. उप-सहारन/);
  fireEvent.change(title, { target: { value: 'Confirmed live update' } });
  fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
  fireEvent.click(screen.getByRole('button', { name: 'हाँ, बदलाव लाइव करें' }));
  await advance();
  fireEvent.change(title, { target: { value: 'Newer local text' } });
  await advance();
  expect(JSON.parse(localStorage.getItem('sautuk:editing:existing')!)).toMatchObject({ title: 'Newer local text', baseUpdatedAt: oldVersion });
  await act(async () => finish(response({ ...basePost, status: 'PUBLISHED', title: 'Confirmed live update', updatedAt: savedVersion })));
  await advance();
  expect(onClose).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem('sautuk:editing:existing')!)).toMatchObject({ title: 'Newer local text', baseUpdatedAt: savedVersion });
});
