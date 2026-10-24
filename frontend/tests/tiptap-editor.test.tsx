import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TiptapEditor from '../src/components/TiptapEditor';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));

afterEach(cleanup);

it('replaces the visible document when imported HTML changes the content prop', async () => {
  const onChange = vi.fn();
  const view = render(<TiptapEditor content="<p>Original document</p>" onChange={onChange} />);
  await waitFor(() => expect(view.container.querySelector('.tiptap')?.textContent).toBe('Original document'));
  onChange.mockClear();

  view.rerender(<TiptapEditor content="<h2>Imported heading</h2><p>Imported Word document</p>" onChange={onChange} />);

  await waitFor(() => expect(view.container.querySelector('.tiptap')?.textContent).toContain('Imported Word document'));
  expect(view.container.querySelector('.tiptap h2')?.textContent).toBe('Imported heading');
  expect(view.container.querySelector('.tiptap')?.textContent).not.toContain('Original document');
  expect(onChange).not.toHaveBeenCalled();
});

it('mounts safely during React StrictMode effect replay', async () => {
  const view = render(<React.StrictMode><TiptapEditor content="<p>Fresh draft</p>" onChange={vi.fn()} /></React.StrictMode>);
  await waitFor(() => expect(view.container.querySelector('.tiptap')?.textContent).toBe('Fresh draft'));
});
