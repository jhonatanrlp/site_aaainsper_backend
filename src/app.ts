import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { athletesRoutes } from './modules/athletes/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { competitionsRoutes } from './modules/competitions/routes.js';
import { documentsRoutes } from './modules/documents/routes.js';
import { duesRoutes } from './modules/dues/routes.js';
import { econoRoutes } from './modules/econo/routes.js';
import { modalitiesRoutes } from './modules/modalities/routes.js';
import { storeRoutes } from './modules/store/routes.js';
import { usersRoutes } from './modules/users/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'info', transport: { target: 'pino-pretty' } }
        : { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get('/health', () => ({ status: 'ok' }));

  await typedApp.register(authRoutes);
  await typedApp.register(usersRoutes);
  await typedApp.register(modalitiesRoutes);
  await typedApp.register(athletesRoutes);
  await typedApp.register(documentsRoutes);
  await typedApp.register(competitionsRoutes);
  await typedApp.register(storeRoutes);
  await typedApp.register(duesRoutes);
  await typedApp.register(econoRoutes);
  await typedApp.register(auditRoutes);

  return app;
}
