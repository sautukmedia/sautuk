import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from '../src/pages/Home';
import { apiFetch, getPosts } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn(), getPosts: vi.fn() }));
vi.mock('framer-motion', () => {
  const element = (tag: string) => (props: Record<string, unknown>) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'whileInView', 'viewport', 'transition', 'whileHover'].includes(key))));
  return { motion: { div: element('div'), article: element('article') } };
});
const story = (id: string) => ({ id, slug: id, title: `Story ${id}`, excerpt: 'A story', createdAt: '2026-10-20T00:00:00Z' });
const firstPage = Array.from({ length: 24 }, (_, index) => story(`first-${index}`));
function openHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Home /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.mocked(apiFetch).mockResolvedValue({ ok: true, json: async () => [] } as unknown as Response);
});
afterEach(cleanup);

it('loads the next bounded archive page while keeping the first page visible', async () => {
  vi.mocked(getPosts).mockImplementation(async filters => {
    if (filters?.featured || filters?.popular) return [];
    return filters?.page === 2 ? [story('second-page')] : firstPage;
  });
  openHome();
  fireEvent.click(await screen.findByRole('button', { name: 'और लेख देखें' }));
  await waitFor(() => expect(screen.getAllByText('Story second-page').length).toBeGreaterThan(0));
  expect(screen.getAllByText('Story first-0').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Story first-23').length).toBeGreaterThan(0);
  expect(getPosts).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 24, status: 'PUBLISHED' }));
  expect(screen.queryByRole('button', { name: 'और लेख देखें' })).toBeNull();
});

it('retains loaded articles after a next-page failure and retries that page', async () => {
  let failed = true;
  vi.mocked(getPosts).mockImplementation(async filters => {
    if (filters?.featured || filters?.popular) return [];
    if (filters?.page === 2) {
      if (failed) throw new Error('Next page unavailable');
      return [story('recovered-page')];
    }
    return firstPage;
  });
  openHome();
  fireEvent.click(await screen.findByRole('button', { name: 'और लेख देखें' }));
  const retry = await screen.findByRole('button', { name: 'फिर से प्रयास करें' });
  expect(screen.getAllByText('Story first-0').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Story first-23').length).toBeGreaterThan(0);
  failed = false;
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getAllByText('Story recovered-page').length).toBeGreaterThan(0));
  expect(screen.getAllByText('Story first-23').length).toBeGreaterThan(0);
  expect(vi.mocked(getPosts).mock.calls.filter(([filters]) => filters?.page === 2)).toHaveLength(2);
});
