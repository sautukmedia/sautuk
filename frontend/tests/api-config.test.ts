import { expect, it } from 'vitest';
import { resolveApiUrl } from '../src/services/api-config';

it('requires a usable production API URL instead of silently targeting localhost', () => {
  for (const value of [undefined, '', 'http://localhost:3000', 'https://127.0.0.1:3000', 'not-a-url', '//api.example.test', 'http://api.example.test']) {
    expect(() => resolveApiUrl(value, true)).toThrow();
  }
  expect(resolveApiUrl('https://api.example.test/', true)).toBe('https://api.example.test');
  expect(resolveApiUrl('/api/', true)).toBe('/api');
  expect(resolveApiUrl(undefined, false)).toBe('http://localhost:3000');
});
