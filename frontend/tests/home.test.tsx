import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
function openHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Home /></MemoryRouter></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.mocked(apiFetch).mockResolvedValue({ ok: true, json: async () => [] } as unknown as Response);
  vi.mocked(getPosts).mockResolvedValue([]);
});
afterEach(cleanup);

it('shows a retryable error instead of claiming the failed feed is empty', async () => {
  let failed = true;
  vi.mocked(getPosts).mockImplementation(async filters => {
    if (filters?.featured || filters?.popular) return [];
    if (failed) throw new Error('Offline');
    return [story('recovered')];
  });
  openHome();
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('लेख लोड नहीं हो सके');
  expect(screen.queryByText('कोई लेख नहीं मिला')).toBeNull();
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'फिर से प्रयास करें' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(screen.getAllByText('Story recovered').length).toBeGreaterThan(0);
});

it('keeps a visible featured link when the fallback list shrinks to one story', async () => {
  vi.mocked(getPosts).mockImplementation(async filters => filters?.featured || filters?.popular ? [] : [story('a'), story('b'), story('c')]);
  const client = openHome();
  fireEvent.click(await screen.findByRole('button', { name: 'विशेष लेख 3' }));
  await act(async () => { client.setQueryData(['posts', undefined, ''], [story('only')]); });
  await waitFor(() => expect(document.querySelector('.featured-story')?.textContent).toContain('Story only'));
  const hero = document.querySelector('.featured-story')!;
  expect(hero.querySelector('a.opacity-100')?.textContent).toContain('Story only');
  expect(screen.queryByRole('button', { name: 'विशेष लेख 3' })).toBeNull();
});

it('keeps articles visible during a categories HTTP failure and retries categories independently', async () => {
  let failed = true;
  vi.mocked(apiFetch).mockImplementation(async () => ({
    ok: !failed,
    status: failed ? 503 : 200,
    json: async () => failed ? { message: 'Categories unavailable' } : [{ id: 'cat', slug: 'recovered-category', name: 'Recovered category' }],
  }) as Response);
  vi.mocked(getPosts).mockResolvedValue([story('readable')]);
  class HomeBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <div>Home crashed</div> : this.props.children; }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><HomeBoundary><Home /></HomeBoundary></MemoryRouter></QueryClientProvider>);

  await waitFor(() => expect(screen.getAllByText('Story readable').length).toBeGreaterThan(0));
  expect(screen.queryByText('Home crashed')).toBeNull();
  expect(screen.getByRole('alert')).toBeTruthy();
  const articleRequests = vi.mocked(getPosts).mock.calls.length;
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'फिर से प्रयास करें' }));
  await waitFor(() => expect(screen.getAllByText('Recovered category').length).toBeGreaterThan(0));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(vi.mocked(getPosts).mock.calls.length).toBe(articleRequests);
});
