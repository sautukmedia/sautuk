import type { Request } from 'express';
import type { Role } from '@prisma/client';

export interface SessionClaims {
  sub?: string;
  sessionVersion?: string;
  role?: Role;
}

export interface AuthenticatedRequest extends Request {
  cookies: Record<string, unknown>;
  user?: { id?: string; sub?: string; email?: string; role?: Role };
}
