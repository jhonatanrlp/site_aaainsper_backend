import { z } from 'zod';

// Common path-param shapes, reused across route files so every route's
// params/querystring/body is a real Zod schema — this is what
// fastify-type-provider-zod turns into accurate OpenAPI, which is what the
// frontend's generated client is built from.
export const idParamSchema = z.object({ id: z.string().uuid() });
