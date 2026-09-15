import { db } from '../../database/client.js';
import { findAthleteById, isAthleteVisibleToDirector } from '../athletes/repository.js';
import { recordAudit } from '../audit/repository.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import {
  findAthleteDocumentByRequirement,
  findAthleteDocumentById,
  listAthleteDocuments as listAthleteDocumentsRepo,
  markSubmitted,
  reviewDocument as reviewDocumentRepo,
  type AthleteDocumentRow,
  type AthleteDocumentWithType,
} from './repository.js';
import { createSignedDownloadUrl, uploadDocumentFile } from './storage.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function assertCanAccessAthleteDocuments(actor: Actor, athleteId: string): Promise<void> {
  const athlete = await findAthleteById(db, athleteId);
  if (!athlete) throw new NotFoundError('Athlete');
  if (actor.role === 'gestao') return;
  if (athlete.userId === actor.id) return;
  if (actor.role === 'dm' && (await isAthleteVisibleToDirector(db, actor.id, athleteId))) return;
  throw new ForbiddenError();
}

export async function listAthleteDocuments(
  actor: Actor,
  athleteId: string,
): Promise<AthleteDocumentWithType[]> {
  await assertCanAccessAthleteDocuments(actor, athleteId);
  return listAthleteDocumentsRepo(db, athleteId);
}

export async function uploadAthleteDocument(params: {
  actor: Actor;
  athleteId: string;
  requiredDocumentId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}): Promise<AthleteDocumentRow> {
  const athlete = await findAthleteById(db, params.athleteId);
  if (!athlete) throw new NotFoundError('Athlete');
  // Only the athlete themselves can upload their own documents.
  if (athlete.userId !== params.actor.id) throw new ForbiddenError();

  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    throw new ForbiddenError('Unsupported file type — only PDF, JPEG, or PNG are accepted');
  }
  if (params.data.byteLength > MAX_FILE_BYTES) {
    throw new ForbiddenError('File is too large');
  }

  const existing = await findAthleteDocumentByRequirement(
    db,
    params.athleteId,
    params.requiredDocumentId,
  );
  if (!existing) {
    throw new NotFoundError('Required document (not applicable to this athlete)');
  }

  const path = `${params.athleteId}/${params.requiredDocumentId}/${Date.now()}-${params.filename}`;
  await uploadDocumentFile(path, params.data, params.mimeType);

  return markSubmitted(db, existing.id, path);
}

export async function getDownloadUrl(actor: Actor, documentId: string): Promise<string> {
  const document = await findAthleteDocumentById(db, documentId);
  if (!document) throw new NotFoundError('Document');
  if (!document.storagePath) throw new NotFoundError('Document has no uploaded file yet');

  await assertCanAccessAthleteDocuments(actor, document.athleteId);
  return createSignedDownloadUrl(document.storagePath);
}

// dm-of-modality or gestão only — never the athlete themselves (no
// self-review), matching the legacy schema's defensive trigger intent.
export async function reviewAthleteDocument(params: {
  actor: Actor;
  documentId: string;
  approve: boolean;
  reason?: string;
}): Promise<AthleteDocumentRow> {
  if (params.actor.role === 'atleta') throw new ForbiddenError();

  return db.transaction(async (tx) => {
    const document = await findAthleteDocumentById(tx, params.documentId);
    if (!document) throw new NotFoundError('Document');

    if (params.actor.role === 'dm') {
      const visible = await isAthleteVisibleToDirector(tx, params.actor.id, document.athleteId);
      if (!visible) throw new ForbiddenError();
    }

    const reviewed = await reviewDocumentRepo(tx, document.id, {
      approve: params.approve,
      reviewedBy: params.actor.id,
      reason: params.reason ?? null,
    });

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: params.approve ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      entity: 'athlete_documents',
      entityId: document.id,
      metadata: { athleteId: document.athleteId, reason: params.reason ?? null },
    });

    return reviewed;
  });
}
