import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
import {
  createCompetitionController,
  createGameController,
  createRegistrationController,
  createTrophyController,
  listBoardMembersController,
  listCompetitionsController,
  listGamesController,
  listRegistrationsController,
  listTrophiesController,
  markRegistrationSeenController,
  updateGameController,
  upsertBoardMemberController,
} from './controller.js';
import {
  createCompetitionSchema,
  createGameSchema,
  createRegistrationSchema,
  createTrophySchema,
  listRegistrationsQuerySchema,
  updateGameSchema,
  upsertBoardMemberSchema,
} from './schema.js';

export function competitionsRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];
  const staff = [authenticate, requireRole('dm', 'gestao')];

  app.get('/competitions', { schema: { tags: ['competitions'] } }, listCompetitionsController);
  app.post(
    '/competitions',
    { preHandler: gestao, schema: { tags: ['competitions'], body: createCompetitionSchema } },
    createCompetitionController,
  );

  app.get('/games', { schema: { tags: ['competitions'] } }, listGamesController);
  app.post(
    '/games',
    { preHandler: staff, schema: { tags: ['competitions'], body: createGameSchema } },
    createGameController,
  );
  app.patch(
    '/games/:id',
    {
      preHandler: staff,
      schema: { tags: ['competitions'], params: idParamSchema, body: updateGameSchema },
    },
    updateGameController,
  );

  app.get(
    '/competition-registrations',
    {
      preHandler: [authenticate],
      schema: { tags: ['competitions'], querystring: listRegistrationsQuerySchema },
    },
    listRegistrationsController,
  );
  app.post(
    '/competition-registrations',
    { preHandler: staff, schema: { tags: ['competitions'], body: createRegistrationSchema } },
    createRegistrationController,
  );
  app.patch(
    '/competition-registrations/:id/mark-seen',
    { preHandler: gestao, schema: { tags: ['competitions'], params: idParamSchema } },
    markRegistrationSeenController,
  );

  app.get('/trophies', { schema: { tags: ['competitions'] } }, listTrophiesController);
  app.post(
    '/trophies',
    { preHandler: gestao, schema: { tags: ['competitions'], body: createTrophySchema } },
    createTrophyController,
  );

  app.get('/board-members', { schema: { tags: ['competitions'] } }, listBoardMembersController);
  app.patch(
    '/board-members',
    { preHandler: gestao, schema: { tags: ['competitions'], body: upsertBoardMemberSchema } },
    upsertBoardMemberController,
  );
}
