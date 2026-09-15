import { and, eq } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { athleteDocuments, requiredDocuments } from '../../database/schema/index.js';
import type { athleteDocuments as AthleteDocumentsTable } from '../../database/schema/index.js';

export type AthleteDocumentRow = typeof AthleteDocumentsTable.$inferSelect;

export interface AthleteDocumentWithType extends AthleteDocumentRow {
  type: string;
  required: boolean;
}

export async function listAthleteDocuments(
  db: DbClient,
  athleteId: string,
): Promise<AthleteDocumentWithType[]> {
  const rows = await db
    .select({
      id: athleteDocuments.id,
      athleteId: athleteDocuments.athleteId,
      requiredDocumentId: athleteDocuments.requiredDocumentId,
      status: athleteDocuments.status,
      storagePath: athleteDocuments.storagePath,
      uploadedAt: athleteDocuments.uploadedAt,
      reviewedBy: athleteDocuments.reviewedBy,
      reviewedAt: athleteDocuments.reviewedAt,
      rejectionReason: athleteDocuments.rejectionReason,
      expiresAt: athleteDocuments.expiresAt,
      createdAt: athleteDocuments.createdAt,
      updatedAt: athleteDocuments.updatedAt,
      type: requiredDocuments.type,
      required: requiredDocuments.required,
    })
    .from(athleteDocuments)
    .innerJoin(requiredDocuments, eq(requiredDocuments.id, athleteDocuments.requiredDocumentId))
    .where(eq(athleteDocuments.athleteId, athleteId));

  return rows;
}

export async function findAthleteDocumentById(
  db: DbClient,
  id: string,
): Promise<AthleteDocumentRow | undefined> {
  const [row] = await db
    .select()
    .from(athleteDocuments)
    .where(eq(athleteDocuments.id, id))
    .limit(1);
  return row;
}

export async function findAthleteDocumentByRequirement(
  db: DbClient,
  athleteId: string,
  requiredDocumentId: string,
): Promise<AthleteDocumentRow | undefined> {
  const [row] = await db
    .select()
    .from(athleteDocuments)
    .where(
      and(
        eq(athleteDocuments.athleteId, athleteId),
        eq(athleteDocuments.requiredDocumentId, requiredDocumentId),
      ),
    )
    .limit(1);
  return row;
}

export async function markSubmitted(
  db: DbClient,
  id: string,
  storagePath: string,
): Promise<AthleteDocumentRow> {
  const [row] = await db
    .update(athleteDocuments)
    .set({
      status: 'submitted',
      storagePath,
      uploadedAt: new Date(),
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(athleteDocuments.id, id))
    .returning();
  if (!row) throw new Error('Athlete document not found');
  return row;
}

export async function reviewDocument(
  db: DbClient,
  id: string,
  values: { approve: boolean; reviewedBy: string; reason: string | null },
): Promise<AthleteDocumentRow> {
  const [row] = await db
    .update(athleteDocuments)
    .set({
      status: values.approve ? 'approved' : 'rejected',
      reviewedBy: values.reviewedBy,
      reviewedAt: new Date(),
      rejectionReason: values.approve ? null : values.reason,
      updatedAt: new Date(),
    })
    .where(eq(athleteDocuments.id, id))
    .returning();
  if (!row) throw new Error('Athlete document not found');
  return row;
}
