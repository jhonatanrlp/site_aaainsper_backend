import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  approveJoinRequestController,
  createJoinRequestController,
  getAthleteController,
  getMyAthleteController,
  listAthletesController,
  rejectJoinRequestController,
} from './controller.js';

export function athletesRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/me',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    getMyAthleteController,
  );
  app.get(
    '/athletes',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    listAthletesController,
  );
  app.get(
    '/athletes/:id',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    getAthleteController,
  );

  app.post(
    '/team-join-requests',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    createJoinRequestController,
  );
  app.patch(
    '/team-join-requests/:id/approve',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    approveJoinRequestController,
  );
  app.patch(
    '/team-join-requests/:id/reject',
    { preHandler: [authenticate], schema: { tags: ['athletes'] } },
    rejectJoinRequestController,
  );
}
