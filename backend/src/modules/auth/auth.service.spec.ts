import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

describe('session revocation', () => {
  const email = 'admin@example.test';
  const originalPassword = 'test-original-password';
  const replacementPassword = 'test-replacement-password';
  let user: User | null;
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
    revokeSessions: jest.Mock;
  };
  let auth: AuthService;
  let jwt: JwtService;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    originalEnv = Object.fromEntries(
      ['ADMIN_EMAIL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN']
        .map((key) => [key, process.env[key]]),
    );
    process.env.ADMIN_EMAIL = email;
    process.env.JWT_SECRET = 'test-only-access-secret-not-used-by-any-server';
    process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-not-used-by-any-server';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '1d';
    user = {
      id: 'test-admin', email, role: Role.ADMIN,
      passwordHash: await bcrypt.hash(originalPassword, 4),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    users = {
      findByEmail: jest.fn(async () => user ? { ...user } : null),
      findById: jest.fn(async () => user ? { ...user } : null),
      updatePassword: jest.fn(async (_id: string, passwordHash: string) => {
        user = { ...user!, passwordHash, updatedAt: new Date(user!.updatedAt.getTime() + 1) };
        return { ...user };
      }),
      revokeSessions: jest.fn(async () => {
        user = { ...user!, updatedAt: new Date(user!.updatedAt.getTime() + 1) };
        return { ...user };
      }),
    };
    jwt = new JwtService();
    auth = new AuthService(users as unknown as UsersService, jwt);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function login() {
    return auth.loginWithCredentials(email, originalPassword);
  }

  function strategy() {
    // Permit adding injected session validation without coupling the regression to a constructor signature.
    return Reflect.construct(JwtStrategy, [auth, users]) as JwtStrategy;
  }

  it('refreshes a current session successfully', async () => {
    const session = await login();
    await expect(auth.refreshSession(session.refreshToken)).resolves.toMatchObject({
      user: { id: 'test-admin', email, role: Role.ADMIN },
    });
  });

  it('accepts access from the current administrator session', async () => {
    const session = await login();
    const payload = jwt.verify(session.accessToken, { secret: process.env.JWT_SECRET });
    await expect(strategy().validate(payload)).resolves.toMatchObject({
      id: 'test-admin', email, role: Role.ADMIN,
    });
  });

  it('rejects a refresh token issued before a password change', async () => {
    const session = await login();
    await auth.changePassword('test-admin', originalPassword, replacementPassword);
    await expect(auth.refreshSession(session.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    const replacement = await auth.loginWithCredentials(email, replacementPassword);
    await expect(auth.refreshSession(replacement.refreshToken)).resolves.toHaveProperty('accessToken');
  });

  it('rejects an access token issued before a password change', async () => {
    const session = await login();
    await auth.changePassword('test-admin', originalPassword, replacementPassword);
    const payload = jwt.verify(session.accessToken, { secret: process.env.JWT_SECRET });
    await expect(strategy().validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['deleted', 'demoted', 'removed from the admin whitelist'])(
    'rejects existing access after the account is %s',
    async (change) => {
      const session = await login();
      if (change === 'deleted') user = null;
      else if (change === 'demoted') user = { ...user!, role: Role.READER };
      else process.env.ADMIN_EMAIL = 'different-admin@example.test';
      const payload = jwt.verify(session.accessToken, { secret: process.env.JWT_SECRET });
      await expect(strategy().validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('revokes a copied refresh token when the browser logs out', async () => {
    const session = await login();
    const controller = new AuthController(auth);
    const response = { clearCookie: jest.fn() } as unknown as Response;
    const request = { cookies: { refreshToken: session.refreshToken } } as Request;
    await Reflect.apply(controller.logout, controller, [response, request]);
    expect(response.clearCookie).toHaveBeenCalled();
    await expect(auth.refreshSession(session.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
