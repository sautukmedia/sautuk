import { expect, it } from 'vitest';
import { apiRequestUrl, netlifyApiRedirects, resolveApiUrl } from '../src/services/api-config';

it('requires a usable production API URL instead of silently targeting localhost', () => {
  for (const value of [undefined, '', 'http://localhost:3000', 'https://127.0.0.1:3000', 'not-a-url', '//api.example.test', 'http://api.example.test']) {
    expect(() => resolveApiUrl(value, true)).toThrow();
  }
  expect(resolveApiUrl('https://api.example.test/', true)).toBe('https://api.example.test');
  expect(resolveApiUrl('/api/', true)).toBe('/api');
  expect(resolveApiUrl(undefined, false)).toBe('http://localhost:3000');
});

it('keeps production authentication on the frontend origin and proxies to the configured upstream', () => {
  expect(apiRequestUrl('/auth/login', 'https://api.example.test/', true)).toBe('/api/auth/login');
  expect(apiRequestUrl('/auth/refresh', 'http://localhost:3000', false)).toBe('http://localhost:3000/auth/refresh');
  expect(apiRequestUrl('/auth/refresh', '/gateway', true)).toBe('/gateway/auth/refresh');
  expect(apiRequestUrl('/media/upload', 'https://api.example.test/', true)).toBe('https://api.example.test/media/upload');
  expect(netlifyApiRedirects('https://api.example.test/')).toBe('/api/auth/* https://api.example.test/auth/:splat 200!\n/* /index.html 200\n');
  expect(netlifyApiRedirects('/api')).not.toContain('https://');
});
