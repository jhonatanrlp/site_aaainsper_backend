import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import {
  changeUserRoleController,
  getOwnProfileController,
  listUsersController,
  revealCpfController,
  updateOwnProfileController,
} from './controller.js';

export function usersRoutes(app: FastifyInstance): void {
  app.get(
    '/users/me',
    { preHandler: [authenticate], schema: { tags: ['users'] } },
    getOwnProfileController,
  );

  app.patch(
    '/users/me',
    { preHandler: [authenticate], schema: { tags: ['users'] } },
    updateOwnProfileController,
  );

  app.get(
    '/users',
    { preHandler: [authenticate, requireRole('gestao')], schema: { tags: ['users'] } },
    listUsersController,
  );

  app.patch(
    '/users/:id/role',
    { preHandler: [authenticate, requireRole('gestao')], schema: { tags: ['users'] } },
    changeUserRoleController,
  );

  app.get(
    '/users/:id/cpf',
    { preHandler: [authenticate, requireRole('gestao')], schema: { tags: ['users'] } },
    revealCpfController,
  );
}
