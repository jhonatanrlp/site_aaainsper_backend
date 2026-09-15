import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  assignDirector,
  createModality,
  createTeam,
  listModalities,
  listTeams,
  unassignDirector,
  updateModality,
  updateTeam,
} from './service.js';
import {
  assignDirectorSchema,
  createModalitySchema,
  createTeamSchema,
  updateModalitySchema,
  updateTeamSchema,
} from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function listModalitiesController(_request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listModalities());
}

export async function createModalityController(request: FastifyRequest, reply: FastifyReply) {
  const input = createModalitySchema.parse(request.body);
  reply.status(201).send(await createModality(input));
}

export async function updateModalityController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const input = updateModalitySchema.parse(request.body);
  reply.send(await updateModality(id, input));
}

export async function listTeamsController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  reply.send(await listTeams(id));
}

export async function createTeamController(request: FastifyRequest, reply: FastifyReply) {
  const input = createTeamSchema.parse(request.body);
  reply.status(201).send(await createTeam(input.modalityId, { name: input.name }));
}

export async function updateTeamController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const input = updateTeamSchema.parse(request.body);
  reply.send(await updateTeam(id, input));
}

export async function assignDirectorController(request: FastifyRequest, reply: FastifyReply) {
  const actor = requireUser(request);
  const { id } = request.params as { id: string };
  const { userId } = assignDirectorSchema.parse(request.body);
  await assignDirector({ actorId: actor.id, modalityId: id, userId });
  reply.status(204).send();
}

export async function unassignDirectorController(request: FastifyRequest, reply: FastifyReply) {
  const actor = requireUser(request);
  const { id, userId } = request.params as { id: string; userId: string };
  await unassignDirector({ actorId: actor.id, modalityId: id, userId });
  reply.status(204).send();
}
