import { isIP } from 'node:net';

export function parseTrustedProxies(value?: string): string[] {
  if (!value?.trim()) return [];
  const entries = value.split(',').map(item => item.trim());
  for (const entry of entries) {
    if (['loopback', 'linklocal', 'uniquelocal'].includes(entry)) continue;
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))) {
      throw new Error('TRUST_PROXY must contain explicit trusted IPs or CIDRs, not a hop count or hostname');
    }
  }
  return entries;
}
