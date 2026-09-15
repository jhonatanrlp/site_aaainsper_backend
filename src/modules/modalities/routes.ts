import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
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
import {
  assignDirectorSchema,
  createModalitySchema,
  createTeamSchema,
  updateModalitySchema,
  updateTeamSchema,
} from './schema.js';

const directorParamsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export function modalitiesRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];

  app.get('/modalities', { schema: { tags: ['modalities'] } }, listModalitiesController);
  app.post(
    '/modalities',
    { preHandler: gestao, schema: { tags: ['modalities'], body: createModalitySchema } },
    createModalityController,
  );
  app.patch(
    '/modalities/:id',
    {
      preHandler: gestao,
      schema: { tags: ['modalities'], params: idParamSchema, body: updateModalitySchema },
    },
    updateModalityController,
  );

  app.get(
    '/modalities/:id/teams',
    { schema: { tags: ['modalities'], params: idParamSchema } },
    listTeamsController,
  );
  app.post(
    '/teams',
    { preHandler: gestao, schema: { tags: ['modalities'], body: createTeamSchema } },
    createTeamController,
  );
  app.patch(
    '/teams/:id',
    {
      preHandler: gestao,
      schema: { tags: ['modalities'], params: idParamSchema, body: updateTeamSchema },
    },
    updateTeamController,
  );

  app.post(
    '/modalities/:id/directors',
    {
      preHandler: gestao,
      schema: { tags: ['modalities'], params: idParamSchema, body: assignDirectorSchema },
    },
    assignDirectorController,
  );
  app.delete(
    '/modalities/:id/directors/:userId',
    {
      preHandler: gestao,
      schema: { tags: ['modalities'], params: directorParamsSchema },
    },
    unassignDirectorController,
  );
}
