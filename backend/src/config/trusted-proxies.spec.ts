import { parseTrustedProxies } from './trusted-proxies';

describe('trusted proxy configuration', () => {
  it.each([undefined, '', '   '])(
    'does not trust forwarding headers by default: %s',
    (input) => {
      expect(parseTrustedProxies(input)).toEqual([]);
    },
  );

  it('accepts named private networks and explicit IPv4/IPv6 addresses or CIDRs', () => {
    expect(
      parseTrustedProxies(
        'loopback, linklocal, uniquelocal, 127.0.0.1, 10.0.0.0/8, ::1, 2001:db8::/32',
      ),
    ).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal',
      '127.0.0.1',
      '10.0.0.0/8',
      '::1',
      '2001:db8::/32',
    ]);
  });

  it.each([
    'true',
    'false',
    'TRUE',
    '1',
    '2',
    '-1',
    '1.5',
    'proxy.example.test',
    'localhost',
    '*',
    '192.168.1.0/33',
    '192.168.1.0/-1',
    '192.168.1.0/not-a-prefix',
    '2001:db8::/129',
    '10.0.0.999',
    '10.0.0.0/8,proxy.example.test',
  ])(
    'rejects permissive hop counts and invalid network configuration: %s',
    (input) => {
      expect(() => parseTrustedProxies(input)).toThrow();
    },
  );
});
