import type { FastifyReply, FastifyRequest } from 'fastify';
import { isDirectorOfModality } from '../modules/modalities/repository.js';
import { findUserById } from '../modules/users/repository.js';
import { UnauthorizedError, ForbiddenError } from '../shared/errors.js';
import { supabaseAdmin } from '../shared/supabase.js';
import { TtlCache } from '../shared/ttl-cache.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'atleta' | 'dm' | 'gestao';
}

export interface SupabaseIdentity {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    identity?: SupabaseIdentity;
  }
}

// Identity (Supabase-verified) and role (our own DB) are cached briefly to
// avoid a network round-trip / DB read on every single request while still
// picking up role changes within a few seconds.
const identityCache = new TtlCache<string, { id: string; email: string }>(30_000);
const roleCache = new TtlCache<string, AuthenticatedUser['role']>(30_000);

async function verifyToken(token: string): Promise<{ id: string; email: string }> {
  const cached = identityCache.get(token);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  const identity = { id: data.user.id, email: data.user.email };
  identityCache.set(token, identity);
  return identity;
}

async function loadRole(userId: string): Promise<AuthenticatedUser['role']> {
  const cached = roleCache.get(userId);
  if (cached) return cached;

  const user = await findUserById(userId);
  if (!user || !user.active) {
    throw new UnauthorizedError('Account not provisioned or inactive');
  }

  roleCache.set(userId, user.role);
  return user.role;
}

function extractToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  return header.slice('Bearer '.length);
}

// Verifies the Supabase access token only (identity, not local role). Used
// by POST /auth/session/bootstrap, the one route that must work before a
// local `users` row necessarily exists yet.
export async function verifyIdentity(request: FastifyRequest): Promise<void> {
  const token = extractToken(request);
  request.identity = await verifyToken(token);
}

// Standard preHandler for every other route: verifies identity AND loads the
// local role, so it requires the user to already be provisioned (i.e. to
// have called the bootstrap route at least once).
export async function authenticate(request: FastifyRequest): Promise<void> {
  const token = extractToken(request);
  const identity = await verifyToken(token);
  const role = await loadRole(identity.id);

  request.user = { id: identity.id, email: identity.email, role };
}

export function requireRole(...roles: AuthenticatedUser['role'][]) {
  return function requireRoleHandler(request: FastifyRequest, _reply: FastifyReply): void {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenError();
    }
  };
}

// dm-of-modality or gestao. `getModalityId` extracts the target modality id
// from the request (params/query/body depending on the route).
export function requireModalityAccess(getModalityId: (request: FastifyRequest) => string) {
  return async function requireModalityAccessHandler(
    request: FastifyRequest,
    _reply: FastifyReply,
  ) {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    if (request.user.role === 'gestao') return;

    if (request.user.role === 'dm') {
      const modalityId = getModalityId(request);
      const isDirector = await isDirectorOfModality(request.user.id, modalityId);
      if (isDirector) return;
    }

    throw new ForbiddenError();
  };
}
