import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'info', transport: { target: 'pino-pretty' } }
        : { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
    trustProxy: true,
  });

  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS,
    credentials: false,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Atlética Insper API',
        version: '1.0.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', () => ({ status: 'ok' }));

  await app.register(authRoutes);

  return app;
}
