import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import {
  assignDirectorController,
  createModalityController,
  createTeamController,
  listModalitiesController,
  listTeamsController,
  unassignDirectorController,
  updateModalityController,
  updateTeamController,
} from './controller.js';

export function modalitiesRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];

  app.get('/modalities', { schema: { tags: ['modalities'] } }, listModalitiesController);
  app.post(
    '/modalities',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    createModalityController,
  );
  app.patch(
    '/modalities/:id',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    updateModalityController,
  );

  app.get('/modalities/:id/teams', { schema: { tags: ['modalities'] } }, listTeamsController);
  app.post(
    '/teams',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    createTeamController,
  );
  app.patch(
    '/teams/:id',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    updateTeamController,
  );

  app.post(
    '/modalities/:id/directors',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    assignDirectorController,
  );
  app.delete(
    '/modalities/:id/directors/:userId',
    { preHandler: gestao, schema: { tags: ['modalities'] } },
    unassignDirectorController,
  );
}
