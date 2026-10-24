import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConfirmModal from '../src/components/ConfirmModal';
afterEach(cleanup);
it('names the warning, focuses cancel, traps Tab, and closes with Escape', () => {
  const onCancel = vi.fn();
  render(<ConfirmModal isOpen title="Publish warning" message="This will go live" onCancel={onCancel} onConfirm={vi.fn()} />);
  const dialog = screen.getByRole('dialog', { name: 'Publish warning' });
  const cancel = screen.getByRole('button', { name: 'रद्द करें (Cancel)' });
  expect(document.activeElement).toBe(cancel);
  const buttons = dialog.querySelectorAll('button');
  buttons[buttons.length - 1].focus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(document.activeElement).toBe(buttons[0]);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);
});
