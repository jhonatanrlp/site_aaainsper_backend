import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getDownloadUrlController,
  listAthleteDocumentsController,
  reviewDocumentController,
  uploadAthleteDocumentController,
} from './controller.js';

export function documentsRoutes(app: FastifyInstance): void {
  app.get(
    '/athletes/:id/documents',
    { preHandler: [authenticate], schema: { tags: ['documents'] } },
    listAthleteDocumentsController,
  );
  app.post(
    '/athletes/:id/documents/:requiredDocumentId',
    { preHandler: [authenticate], schema: { tags: ['documents'] } },
    uploadAthleteDocumentController,
  );
  app.get(
    '/documents/:id/download-url',
    { preHandler: [authenticate], schema: { tags: ['documents'] } },
    getDownloadUrlController,
  );
  app.patch(
    '/documents/:id/review',
    { preHandler: [authenticate], schema: { tags: ['documents'] } },
    reviewDocumentController,
  );
}
