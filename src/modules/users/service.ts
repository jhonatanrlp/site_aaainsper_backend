import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { maskCpf } from '../../shared/cpf.js';
import type { Page } from '../../shared/pagination.js';
import {
  findUserById,
  listUsers as listUsersRepo,
  updateOwnProfile,
  updateUserRole,
  type UserRow,
} from './repository.js';
import type { UpdateOwnProfileInput, UserProfileResponse } from './schema.js';

export function toProfileResponse(user: UserRow): UserProfileResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    cpfMask: maskCpf(user.cpf),
    rg: user.rg,
    birthDate: user.birthDate,
    course: user.course,
    instagram: user.instagram,
    phone: user.phone,
    role: user.role,
    active: user.active,
  };
}

export async function getOwnProfile(userId: string): Promise<UserProfileResponse> {
  const user = await findUserById(db, userId);
  if (!user) throw new NotFoundError('User');
  return toProfileResponse(user);
}

export async function completeOwnProfile(
  userId: string,
  input: UpdateOwnProfileInput,
): Promise<UserProfileResponse> {
  const user = await updateOwnProfile(db, userId, input);
  return toProfileResponse(user);
}

export async function listUsers(params: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<Page<UserProfileResponse>> {
  const { rows, total } = await listUsersRepo(db, params);
  return {
    items: rows.map(toProfileResponse),
    total,
    limit: params.limit,
    offset: params.offset,
  };
}

// gestão only, enforced by the route guard. Self-targeting is blocked
// unconditionally here — role changes always require a second gestão member.
export async function changeUserRole(params: {
  actorId: string;
  targetUserId: string;
  role: UserRow['role'];
}): Promise<UserProfileResponse> {
  if (params.actorId === params.targetUserId) {
    throw new ForbiddenError('You cannot change your own role');
  }

  return db.transaction(async (tx) => {
    const updated = await updateUserRole(tx, params.targetUserId, params.role, params.actorId);
    await recordAudit(tx, {
      actorId: params.actorId,
      action: 'ROLE_CHANGED',
      entity: 'users',
      entityId: params.targetUserId,
      metadata: { role: params.role },
    });
    return toProfileResponse(updated);
  });
}

// gestão only, audit-logged on every call — raw CPF is otherwise never
// returned by any read in this API (see toProfileResponse above).
export async function revealCpf(params: {
  actorId: string;
  targetUserId: string;
}): Promise<{ cpf: string | null }> {
  return db.transaction(async (tx) => {
    const user = await findUserById(tx, params.targetUserId);
    if (!user) throw new NotFoundError('User');

    await recordAudit(tx, {
      actorId: params.actorId,
      action: 'CPF_VIEWED',
      entity: 'users',
      entityId: params.targetUserId,
    });

    return { cpf: user.cpf };
  });
}
