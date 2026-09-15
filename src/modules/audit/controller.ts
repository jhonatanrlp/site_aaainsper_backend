import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../../database/client.js';
import { listAuditLogs } from './repository.js';
import { listAuditLogsQuerySchema } from './schema.js';

export async function listAuditLogsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = listAuditLogsQuerySchema.parse(request.query);
  const page = await listAuditLogs(db, query);
  reply.send(page);
}
