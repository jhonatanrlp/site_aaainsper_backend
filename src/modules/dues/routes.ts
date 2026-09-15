import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
import { listDuesController, markDuesController } from './controller.js';
import { markDuesSchema } from './schema.js';

const duesParamsSchema = z.object({ id: z.string().uuid(), semester: z.string().min(1) });

export function duesRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/:id/dues',
    { preHandler: [authenticate], schema: { tags: ['dues'], params: idParamSchema } },
    listDuesController,
  );
  app.patch(
    '/athletes/:id/dues/:semester',
    {
      preHandler: [authenticate],
      schema: { tags: ['dues'], params: duesParamsSchema, body: markDuesSchema },
    },
    markDuesController,
  );
}
