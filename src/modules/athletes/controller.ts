import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  approveJoinRequest,
  createJoinRequest,
  getAthleteDetail,
  getMyAthleteSummary,
  listAthletes,
  rejectJoinRequest,
} from './service.js';
import {
  createJoinRequestSchema,
  listAthletesQuerySchema,
  rejectJoinRequestSchema,
} from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function getMyAthleteController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  reply.send(await getMyAthleteSummary(user.id));
}

export async function listAthletesController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const query = listAthletesQuerySchema.parse(request.query);
  reply.send(await listAthletes(user, query));
}

export async function getAthleteController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await getAthleteDetail(user, id));
}

export async function createJoinRequestController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { teamId } = createJoinRequestSchema.parse(request.body);
  reply.status(201).send(await createJoinRequest(user, teamId));
}

export async function approveJoinRequestController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await approveJoinRequest({ actor: user, requestId: id }));
}

export async function rejectJoinRequestController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const { reason } = rejectJoinRequestSchema.parse(request.body);
  reply.send(await rejectJoinRequest({ actor: user, requestId: id, reason }));
}
