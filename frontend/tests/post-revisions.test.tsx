import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PostEditor from '../src/pages/admin/PostEditor';
import { apiFetch } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/components/TiptapEditor', () => ({ default: () => <div>Editor</div> }));
vi.mock('mammoth', () => ({ default: {} }));

const key = 'sautuk:editing:published';
const latestVersion = '2026-10-24T12:00:00.002Z';
const serverPost = {
  id: 'published', title: 'Latest server article', slug: 'published',
  excerpt: 'Latest server excerpt', content: '<p>Latest server body</p>',
  featuredImage: 'https://example.test/cover.jpg', categoryId: 'cat',
  tags: [], status: 'PUBLISHED', featured: false, updatedAt: latestVersion,
};
const oldCopy = {
  baseUpdatedAt: '2026-10-24T12:00:00.001Z',
  title: 'Older local edits', slug: 'published', excerpt: 'Local excerpt',
  content: '<p>Local work to recover</p>',
  featuredImage: 'https://example.test/cover.jpg', categoryId: 'cat',
  selectedTagIds: [], status: 'PUBLISHED', featured: false,
  seoTitle: '', seoDescription: '',
};
const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const writes = () => vi.mocked(apiFetch).mock.calls.filter(([, options]) => options?.method === 'PATCH' || options?.method === 'POST');
async function advance() { await act(async () => { await vi.advanceTimersByTimeAsync(100); }); }
function openEditor(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><PostEditor postId="published" onClose={onClose} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  localStorage.setItem(key, JSON.stringify(oldCopy));
  vi.mocked(apiFetch).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return response({ ...serverPost, ...JSON.parse(options.body as string) });
    return response(path === '/posts/published' ? serverPost : []);
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

it('opens the latest server revision and preserves a conflicting local copy for recovery', async () => {
  openEditor();
  await advance();
  expect((screen.getByPlaceholderText(/उदा\. उप-सहारन/) as HTMLInputElement).value).toBe('Latest server article');
  expect(screen.getByRole('alert').textContent).toContain('पुरानी संपादन प्रति');
  expect((screen.getByLabelText('पुरानी संपादन प्रति') as HTMLTextAreaElement).value).toContain('Local work to recover');
  expect(localStorage.getItem(key)).toBe(JSON.stringify(oldCopy));
  expect(writes()).toHaveLength(0);
});

it('cannot publish or discard the recovery copy before the administrator acknowledges it', async () => {
  const onClose = vi.fn();
  openEditor(onClose);
  await advance();
  fireEvent.change(screen.getByPlaceholderText(/उदा\. उप-सहारन/), { target: { value: 'New edits to latest revision' } });
  fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
  const confirm = screen.queryByRole('button', { name: 'हाँ, बदलाव लाइव करें' });
  if (confirm) fireEvent.click(confirm);
  await advance();
  expect(writes()).toHaveLength(0);
  expect(onClose).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe(JSON.stringify(oldCopy));
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('allows an explicitly acknowledged recovery to proceed using the latest server revision', async () => {
  openEditor();
  await advance();
  fireEvent.click(screen.getByRole('button', { name: 'पुराने बदलाव सुरक्षित हैं, नए संस्करण से जारी रखें' }));
  await advance();
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText(/उदा\. उप-सहारन/), { target: { value: 'Reviewed new revision' } });
  fireEvent.click(screen.getByRole('button', { name: 'बदलाव प्रकाशित करें' }));
  fireEvent.click(screen.getByRole('button', { name: 'हाँ, बदलाव लाइव करें' }));
  await advance();
  expect(writes()).toHaveLength(1);
  expect(JSON.parse(writes()[0][1]!.body as string)).toMatchObject({
    title: 'Reviewed new revision', expectedUpdatedAt: latestVersion,
  });
});
