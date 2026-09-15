import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import {
  createScenarioController,
  createTournamentController,
  deleteScenarioController,
  getTournamentController,
  listMatchesController,
  listScenariosController,
  recordMatchResultsController,
  setStandingsController,
  updateTournamentController,
} from './controller.js';

export function econoRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];
  const staff = [authenticate, requireRole('dm', 'gestao')];

  app.get('/tournaments/:id', { schema: { tags: ['econo'] } }, getTournamentController);
  app.post(
    '/tournaments',
    { preHandler: gestao, schema: { tags: ['econo'] } },
    createTournamentController,
  );
  app.patch(
    '/tournaments/:id',
    { preHandler: gestao, schema: { tags: ['econo'] } },
    updateTournamentController,
  );

  app.get(
    '/tournament-modalities/:id/matches',
    { schema: { tags: ['econo'] } },
    listMatchesController,
  );
  app.post(
    '/matches/:id/results',
    { preHandler: staff, schema: { tags: ['econo'] } },
    recordMatchResultsController,
  );
  app.patch(
    '/standings/:tournamentModalityId',
    { preHandler: staff, schema: { tags: ['econo'] } },
    setStandingsController,
  );

  app.get(
    '/tournaments/:id/scenarios',
    { preHandler: staff, schema: { tags: ['econo'] } },
    listScenariosController,
  );
  app.post(
    '/tournaments/:id/scenarios',
    { preHandler: staff, schema: { tags: ['econo'] } },
    createScenarioController,
  );
  app.delete(
    '/tournaments/:id/scenarios/:scenarioId',
    { preHandler: staff, schema: { tags: ['econo'] } },
    deleteScenarioController,
  );
}
