import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';

const verifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
}));

describe('Google account verification', () => {
  const before = {
    client: process.env.GOOGLE_CLIENT_ID,
    email: process.env.ADMIN_EMAIL,
    secret: process.env.JWT_SECRET,
  };
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.ADMIN_EMAIL = 'admin@example.test';
    process.env.JWT_SECRET = 'fixture-only-google-session-key';
    verifyIdToken.mockReset();
  });
  afterAll(() => {
    if (before.client === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = before.client;
    if (before.email === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = before.email;
    if (before.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = before.secret;
  });
  it.each([false, undefined])(
    'rejects a matching admin email when Google email_verified is %s',
    async (verified) => {
      const findByEmail = jest.fn();
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'admin@example.test',
          email_verified: verified,
        }),
      });
      const auth = new AuthService(
        { findByEmail } as unknown as UsersService,
        new JwtService(),
      );
      await expect(auth.loginWithGoogle('test-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(findByEmail).not.toHaveBeenCalled();
    },
  );
  it('does not verify a token without a configured audience', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const auth = new AuthService({} as UsersService, new JwtService());
    await expect(auth.loginWithGoogle('test-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
  it('still signs in the verified whitelisted administrator', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'admin@example.test', email_verified: true }),
    });
    const user = {
      id: 'admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      passwordHash: null,
      updatedAt: new Date(),
    };
    const auth = new AuthService(
      {
        findByEmail: jest.fn(() => Promise.resolve(user)),
      } as unknown as UsersService,
      { sign: jest.fn(() => 'fixture-jwt') } as unknown as JwtService,
    );
    await expect(auth.loginWithGoogle('test-token')).resolves.toMatchObject({
      accessToken: 'fixture-jwt',
      user: { role: 'ADMIN' },
    });
  });
});
