import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ChangePasswordModal from '../src/components/ChangePasswordModal';
import { apiFetch } from '../src/services/api';
import { useAuthStore } from '../src/store/useAuthStore';

vi.mock('../src/services/api', () => ({ apiFetch: vi.fn() }));

afterEach(() => { cleanup(); useAuthStore.getState().clearAuth(); });

it('clears the revoked administrator session after changing the password successfully', async () => {
  useAuthStore.getState().setAuth('fabricated-test-access-token', {
    id: 'test-admin', email: 'admin@example.test', role: 'ADMIN',
  });
  vi.mocked(apiFetch).mockResolvedValue({ ok: true, json: async () => ({ message: 'Password successfully changed' }) } as Response);
  const onClose = vi.fn();
  render(<ChangePasswordModal isOpen onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText('अपना वर्तमान पासवर्ड दर्ज करें'), { target: { value: 'old-test-password' } });
  fireEvent.change(screen.getByPlaceholderText('नया पासवर्ड (कम से कम 6 अक्षर)'), { target: { value: 'new-test-password' } });
  fireEvent.change(screen.getByPlaceholderText('नया पासवर्ड दोबारा दर्ज करें'), { target: { value: 'new-test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'पासवर्ड बदलें' }));

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(apiFetch).toHaveBeenCalledWith('/auth/change-password', {
    method: 'POST', body: JSON.stringify({ oldPassword: 'old-test-password', newPassword: 'new-test-password' }),
  });
  expect(useAuthStore.getState().accessToken).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
});
