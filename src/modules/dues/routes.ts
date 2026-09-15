import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { listDuesController, markDuesController } from './controller.js';

export function duesRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/:id/dues',
    { preHandler: [authenticate], schema: { tags: ['dues'] } },
    listDuesController,
  );
  app.patch(
    '/athletes/:id/dues/:semester',
    { preHandler: [authenticate], schema: { tags: ['dues'] } },
    markDuesController,
  );
}
