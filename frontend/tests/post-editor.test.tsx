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
function openEditor(postId: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PostEditor postId={postId} onClose={vi.fn()} /></QueryClientProvider>);
}

describe('editor autosave', () => {
  beforeEach(() => {
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
});
