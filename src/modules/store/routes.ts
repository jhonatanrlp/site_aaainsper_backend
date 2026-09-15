import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import {
  createProductController,
  createReservationController,
  listProductsController,
  listReservationsController,
  updateProductController,
  updateReservationStatusController,
} from './controller.js';

export function storeRoutes(app: FastifyInstance): void {
  const gestao = [authenticate, requireRole('gestao')];

  app.get('/products', { schema: { tags: ['store'] } }, listProductsController);
  app.post(
    '/products',
    { preHandler: gestao, schema: { tags: ['store'] } },
    createProductController,
  );
  app.patch(
    '/products/:id',
    { preHandler: gestao, schema: { tags: ['store'] } },
    updateProductController,
  );

  app.get(
    '/reservations',
    { preHandler: gestao, schema: { tags: ['store'] } },
    listReservationsController,
  );
  app.post(
    '/reservations',
    { preHandler: [authenticate], schema: { tags: ['store'] } },
    createReservationController,
  );
  app.patch(
    '/reservations/:id/status',
    { preHandler: gestao, schema: { tags: ['store'] } },
    updateReservationStatusController,
  );
}
