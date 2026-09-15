import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
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

export function competitionsRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];
  const staff = [authenticate, requireRole('dm', 'gestao')];

  app.get('/competitions', { schema: { tags: ['competitions'] } }, listCompetitionsController);
  app.post(
    '/competitions',
    { preHandler: gestao, schema: { tags: ['competitions'] } },
    createCompetitionController,
  );

  app.get('/games', { schema: { tags: ['competitions'] } }, listGamesController);
  app.post(
    '/games',
    { preHandler: staff, schema: { tags: ['competitions'] } },
    createGameController,
  );
  app.patch(
    '/games/:id',
    { preHandler: staff, schema: { tags: ['competitions'] } },
    updateGameController,
  );

  app.get(
    '/competition-registrations',
    { preHandler: [authenticate], schema: { tags: ['competitions'] } },
    listRegistrationsController,
  );
  app.post(
    '/competition-registrations',
    { preHandler: staff, schema: { tags: ['competitions'] } },
    createRegistrationController,
  );
  app.patch(
    '/competition-registrations/:id/mark-seen',
    { preHandler: gestao, schema: { tags: ['competitions'] } },
    markRegistrationSeenController,
  );

  app.get('/trophies', { schema: { tags: ['competitions'] } }, listTrophiesController);
  app.post(
    '/trophies',
    { preHandler: gestao, schema: { tags: ['competitions'] } },
    createTrophyController,
  );

  app.get('/board-members', { schema: { tags: ['competitions'] } }, listBoardMembersController);
  app.patch(
    '/board-members',
    { preHandler: gestao, schema: { tags: ['competitions'] } },
    upsertBoardMemberController,
  );
}
