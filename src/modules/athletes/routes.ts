import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
import {
  approveJoinRequestController,
  createJoinRequestController,
  getAthleteController,
  getMyAthleteController,
  listAthletesController,
  rejectJoinRequestController,
} from './controller.js';
import {
  createJoinRequestSchema,
  listAthletesQuerySchema,
  rejectJoinRequestSchema,
} from './schema.js';

export function athletesRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/me',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    getMyAthleteController,
  );
  app.get(
    '/athletes',
    {
      preHandler: [authenticate],
      schema: { tags: ['athletes'], querystring: listAthletesQuerySchema },
    },
    listAthletesController,
  );
  app.get(
    '/athletes/:id',
    { preHandler: [authenticate], schema: { tags: ['athletes'], params: idParamSchema } },
    getAthleteController,
  );

  app.post(
    '/team-join-requests',
    { preHandler: [authenticate], schema: { tags: ['athletes'], body: createJoinRequestSchema } },
    createJoinRequestController,
  );
  app.patch(
    '/team-join-requests/:id/approve',
    { preHandler: [authenticate], schema: { tags: ['athletes'], params: idParamSchema } },
    approveJoinRequestController,
  );
  app.patch(
    '/team-join-requests/:id/reject',
    {
      preHandler: [authenticate],
      schema: { tags: ['athletes'], params: idParamSchema, body: rejectJoinRequestSchema },
    },
    rejectJoinRequestController,
  );
}
