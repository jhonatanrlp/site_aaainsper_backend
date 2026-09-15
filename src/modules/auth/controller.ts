import type { FastifyReply, FastifyRequest } from 'fastify';
import { bootstrapSession, isProfileComplete } from './service.js';
import type { BootstrapResponse } from './schema.js';

export async function bootstrapController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.identity) {
    throw new Error('bootstrapController requires the verifyIdentity preHandler');
  }

  const user = await bootstrapSession(request.identity);

  const response: BootstrapResponse = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    profileComplete: isProfileComplete(user),
  };

  reply.send(response);
}
