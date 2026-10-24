import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PostRead from '../src/pages/PostRead';
import { getPost } from '../src/services/api';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn(), getPost: vi.fn(), getPosts: vi.fn(async () => []) }));
vi.mock('framer-motion', () => ({ useScroll: () => ({ scrollYProgress: 0 }), useSpring: () => 0, motion: new Proxy({}, { get: (_target, tag: string) => (props: Record<string, unknown>) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !['style', 'initial', 'animate', 'whileInView', 'viewport', 'transition'].includes(key)))) }) }));
beforeEach(() => {
  vi.mocked(getPost).mockResolvedValue({ id: 'p', slug: 'p', title: 'Published story', content: '<p>Content</p>', createdAt: '2026-10-20T00:00:00Z' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function openArticle() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/posts/p']}><Routes><Route path="/posts/:slug" element={<PostRead />} /></Routes></MemoryRouter></QueryClientProvider>);
  return screen.findByTitle('लिंक कॉपी करें');
}
it('reports clipboard denial instead of claiming the link was copied', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
  fireEvent.click(await openArticle());
  expect((await screen.findByRole('alert')).textContent).toContain('लिंक कॉपी नहीं हुआ');
  expect(screen.getByTitle('लिंक कॉपी करें').querySelector('.lucide-check')).toBeNull();
});
it('only shows copy success after the clipboard write resolves', async () => {
  let finish!: () => void;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) } });
  const button = await openArticle();
  fireEvent.click(button);
  expect(button.querySelector('.lucide-check')).toBeNull();
  await act(async () => finish());
  expect(button.querySelector('.lucide-check')).toBeTruthy();
});
