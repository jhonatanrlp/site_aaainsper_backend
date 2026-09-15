import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { idParamSchema } from '../../shared/route-schemas.js';
import {
  getDownloadUrlController,
  listAthleteDocumentsController,
  reviewDocumentController,
  uploadAthleteDocumentController,
} from './controller.js';
import { reviewDocumentSchema } from './schema.js';

const uploadParamsSchema = z.object({
  id: z.string().uuid(),
  requiredDocumentId: z.string().uuid(),
});

export function documentsRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/:id/documents',
    { preHandler: [authenticate], schema: { tags: ['documents'], params: idParamSchema } },
    listAthleteDocumentsController,
  );
  app.post(
    '/athletes/:id/documents/:requiredDocumentId',
    // multipart body — not a JSON zod body schema; @fastify/multipart parses it.
    { preHandler: [authenticate], schema: { tags: ['documents'], params: uploadParamsSchema } },
    uploadAthleteDocumentController,
  );
  app.get(
    '/documents/:id/download-url',
    { preHandler: [authenticate], schema: { tags: ['documents'], params: idParamSchema } },
    getDownloadUrlController,
  );
  app.patch(
    '/documents/:id/review',
    {
      preHandler: [authenticate],
      schema: { tags: ['documents'], params: idParamSchema, body: reviewDocumentSchema },
    },
    reviewDocumentController,
  );
}
