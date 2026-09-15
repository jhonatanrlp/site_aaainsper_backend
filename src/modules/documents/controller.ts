import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError } from '../../shared/errors.js';
import {
  getDownloadUrl,
  listAthleteDocuments,
  reviewAthleteDocument,
  uploadAthleteDocument,
} from './service.js';
import { reviewDocumentSchema } from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function listAthleteDocumentsController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await listAthleteDocuments(user, id));
}

export async function uploadAthleteDocumentController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = requireUser(request);
  const { id, requiredDocumentId } = request.params as { id: string; requiredDocumentId: string };

  const file = await request.file();
  if (!file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A file is required');
  }
  const data = await file.toBuffer();

  const result = await uploadAthleteDocument({
    actor: user,
    athleteId: id,
    requiredDocumentId,
    filename: file.filename,
    mimeType: file.mimetype,
    data,
  });
  reply.send(result);
}

export async function getDownloadUrlController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send({ url: await getDownloadUrl(user, id) });
}

export async function reviewDocumentController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const { approve, reason } = reviewDocumentSchema.parse(request.body);
  reply.send(
    await reviewAthleteDocument({
      actor: user,
      documentId: id,
      approve,
      ...(reason ? { reason } : {}),
    }),
  );
}
