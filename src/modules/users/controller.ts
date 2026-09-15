import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  changeUserRole,
  completeOwnProfile,
  getOwnProfile,
  listUsers,
  revealCpf,
} from './service.js';
import { listUsersQuerySchema, updateOwnProfileSchema, updateRoleSchema } from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function getOwnProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = requireUser(request);
  reply.send(await getOwnProfile(user.id));
}

export async function updateOwnProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = requireUser(request);
  const input = updateOwnProfileSchema.parse(request.body);
  reply.send(await completeOwnProfile(user.id, input));
}

export async function listUsersController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = listUsersQuerySchema.parse(request.query);
  reply.send(await listUsers(query));
}

export async function changeUserRoleController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = requireUser(request);
  const { id } = request.params as { id: string };
  const { role } = updateRoleSchema.parse(request.body);
  reply.send(await changeUserRole({ actorId: actor.id, targetUserId: id, role }));
}

export async function revealCpfController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const actor = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await revealCpf({ actorId: actor.id, targetUserId: id }));
}
