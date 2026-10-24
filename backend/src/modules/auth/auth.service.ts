import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { Role, User } from '@prisma/client';
import type { SessionClaims } from './auth.types';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // Google OAuth Login
  async loginWithGoogle(token: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const email = payload.email.toLowerCase();
      const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();

      // STRICT CHECK: Verify email is the whitelisted single admin
      if (email !== adminEmail) {
        throw new UnauthorizedException(
          'Access denied: Unauthorized email address',
        );
      }

      // Find or create admin user in DB
      let user = await this.usersService.findByEmail(email);
      if (!user) {
        user = await this.usersService.create({
          email,
          role: Role.ADMIN,
        });
      } else if (user.role !== Role.ADMIN) {
        // Ensure role is admin
        throw new UnauthorizedException(
          'Access denied: Insufficient privileges',
        );
      }

      return this.generateAuthResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Google authentication failed: ' + (error as Error).message,
      );
    }
  }

  // Credentials Login
  async loginWithCredentials(email: string, pass: string) {
    const lowerEmail = email.toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();

    // STRICT CHECK: Only admin is whitelisted to log in to dashboard
    if (lowerEmail !== adminEmail) {
      throw new UnauthorizedException(
        'Access denied: Unauthorized email address',
      );
    }

    const user = await this.usersService.findByEmail(lowerEmail);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Access denied: Insufficient privileges');
    }

    return this.generateAuthResponse(user);
  }

  // Generate Access and Refresh JWTs
  private generateAuthResponse(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: this.sessionVersion(user),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRES_IN ??
        '1d') as JwtSignOptions['expiresIn'],
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
        '7d') as JwtSignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Refresh Token validation
  async refreshSession(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<SessionClaims>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.sessionUser(payload);

      // Generate new access token
      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionVersion: this.sessionVersion(user),
      };
      const accessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRES_IN ??
          '1d') as JwtSignOptions['expiresIn'],
      });

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // Change Password
  private sessionVersion(user: User): string {
    return createHmac('sha256', process.env.JWT_SECRET!)
      .update(
        JSON.stringify([
          user.id,
          user.passwordHash,
          user.updatedAt.toISOString(),
        ]),
      )
      .digest('hex');
  }

  private async sessionUser(payload: {
    sub?: string;
    sessionVersion?: string;
  }) {
    const user =
      typeof payload.sub === 'string'
        ? await this.usersService.findById(payload.sub)
        : null;
    if (
      !user ||
      user.role !== Role.ADMIN ||
      user.email.toLowerCase() !== (process.env.ADMIN_EMAIL ?? '').toLowerCase()
    ) {
      throw new UnauthorizedException('Session no longer authorized');
    }
    const expected = Buffer.from(this.sessionVersion(user));
    const received = Buffer.from(
      typeof payload.sessionVersion === 'string' ? payload.sessionVersion : '',
    );
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Session revoked; sign in again');
    }
    return user;
  }

  async validateAccessToken(payload: {
    sub?: string;
    sessionVersion?: string;
  }) {
    const user = await this.sessionUser(payload);
    return { id: user.id, sub: user.id, email: user.email, role: user.role };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    let payload: { sub?: string; sessionVersion?: string };
    try {
      payload = this.jwtService.verify<SessionClaims>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      return;
    }
    const user = await this.sessionUser(payload).catch((error) => {
      if (error instanceof UnauthorizedException) return null;
      throw error;
    });
    if (user) await this.usersService.revokeSessions(user.id);
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) {
      throw new BadRequestException('User not found or invalid credentials');
    }

    const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException(
        'पुराना पासवर्ड गलत है (Incorrect old password)',
      );
    }

    const hashedNewPass = await this.hashPassword(newPass);
    await this.usersService.updatePassword(userId, hashedNewPass);

    return { message: 'Password successfully changed' };
  }

  // Password hashing utility for seeding / registration
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
