import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
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
import {
  createScenarioSchema,
  createTournamentSchema,
  recordMatchResultsSchema,
  setStandingsSchema,
  updateTournamentSchema,
} from './schema.js';

const standingsParamsSchema = z.object({ tournamentModalityId: z.string().uuid() });
const scenarioParamsSchema = z.object({ id: z.string().uuid(), scenarioId: z.string().uuid() });

export function econoRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];
  const staff = [authenticate, requireRole('dm', 'gestao')];

  app.get(
    '/tournaments/:id',
    { schema: { tags: ['econo'], params: idParamSchema } },
    getTournamentController,
  );
  app.post(
    '/tournaments',
    { preHandler: gestao, schema: { tags: ['econo'], body: createTournamentSchema } },
    createTournamentController,
  );
  app.patch(
    '/tournaments/:id',
    {
      preHandler: gestao,
      schema: { tags: ['econo'], params: idParamSchema, body: updateTournamentSchema },
    },
    updateTournamentController,
  );

  app.get(
    '/tournament-modalities/:id/matches',
    { schema: { tags: ['econo'], params: idParamSchema } },
    listMatchesController,
  );
  app.post(
    '/matches/:id/results',
    {
      preHandler: staff,
      schema: { tags: ['econo'], params: idParamSchema, body: recordMatchResultsSchema },
    },
    recordMatchResultsController,
  );
  app.patch(
    '/standings/:tournamentModalityId',
    {
      preHandler: staff,
      schema: { tags: ['econo'], params: standingsParamsSchema, body: setStandingsSchema },
    },
    setStandingsController,
  );

  app.get(
    '/tournaments/:id/scenarios',
    { preHandler: staff, schema: { tags: ['econo'], params: idParamSchema } },
    listScenariosController,
  );
  app.post(
    '/tournaments/:id/scenarios',
    {
      preHandler: staff,
      schema: { tags: ['econo'], params: idParamSchema, body: createScenarioSchema },
    },
    createScenarioController,
  );
  app.delete(
    '/tournaments/:id/scenarios/:scenarioId',
    { preHandler: staff, schema: { tags: ['econo'], params: scenarioParamsSchema } },
    deleteScenarioController,
  );
}
