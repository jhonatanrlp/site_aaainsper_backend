import type { FastifyInstance } from 'fastify';
import { verifyIdentity } from '../../middleware/auth.js';
import { bootstrapController } from './controller.js';

export function authRoutes(app: FastifyInstance): void {
  app.post(
    '/auth/session/bootstrap',
    {
      preHandler: [verifyIdentity],
      schema: {
        tags: ['auth'],
        summary: 'Verify the Supabase session and provision/return the local user profile',
      },
    },
    bootstrapController,
  );
}
