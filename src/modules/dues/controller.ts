import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import { listDues, markDues } from './service.js';
import { markDuesSchema } from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function listDuesController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await listDues(user, id));
}

export async function markDuesController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id, semester } = request.params as { id: string; semester: string };
  const { paymentStatus } = markDuesSchema.parse(request.body);
  reply.send(await markDues({ actor: user, athleteId: id, semester, paymentStatus }));
}
