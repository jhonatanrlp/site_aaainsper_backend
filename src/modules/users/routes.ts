import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
import {
  changeUserRoleController,
  getOwnProfileController,
  listUsersController,
  revealCpfController,
  updateOwnProfileController,
} from './controller.js';
import { listUsersQuerySchema, updateOwnProfileSchema, updateRoleSchema } from './schema.js';

export function usersRoutes(app: FastifyInstance): void {
  app.get(
    '/users/me',
    { preHandler: [authenticate], schema: { tags: ['users'] } },
    getOwnProfileController,
  );

  app.patch(
    '/users/me',
    {
      preHandler: [authenticate],
      schema: { tags: ['users'], body: updateOwnProfileSchema },
    },
    updateOwnProfileController,
  );

  app.get(
    '/users',
    {
      preHandler: [authenticate, requireRole('gestao')],
      schema: { tags: ['users'], querystring: listUsersQuerySchema },
    },
    listUsersController,
  );

  app.patch(
    '/users/:id/role',
    {
      preHandler: [authenticate, requireRole('gestao')],
      schema: { tags: ['users'], params: idParamSchema, body: updateRoleSchema },
    },
    changeUserRoleController,
  );

  app.get(
    '/users/:id/cpf',
    {
      preHandler: [authenticate, requireRole('gestao')],
      schema: { tags: ['users'], params: idParamSchema },
    },
    revealCpfController,
  );
}
