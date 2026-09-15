import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { listAuditLogsController } from './controller.js';
import { listAuditLogsQuerySchema } from './schema.js';

export function auditRoutes(app: FastifyInstance): void {
  app.get(
    '/audit-logs',
    {
      preHandler: [authenticate, requireRole('gestao')],
      schema: {
        tags: ['audit'],
        summary: 'List audit log entries (gestão only)',
        querystring: listAuditLogsQuerySchema,
      },
    },
    listAuditLogsController,
  );
}
