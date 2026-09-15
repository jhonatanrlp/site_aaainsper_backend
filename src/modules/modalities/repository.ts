import { and, eq } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { modalities, modalityDirectors, teams } from '../../database/schema/index.js';
import type {
  modalities as ModalitiesTable,
  teams as TeamsTable,
} from '../../database/schema/index.js';

export type ModalityRow = typeof ModalitiesTable.$inferSelect;
export type TeamRow = typeof TeamsTable.$inferSelect;

export async function isDirectorOfModality(
  db: DbClient,
  userId: string,
  modalityId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: modalityDirectors.userId })
    .from(modalityDirectors)
    .where(and(eq(modalityDirectors.userId, userId), eq(modalityDirectors.modalityId, modalityId)))
    .limit(1);
  return row !== undefined;
}

export async function listDirectedModalityIds(db: DbClient, userId: string): Promise<string[]> {
  const rows = await db
    .select({ modalityId: modalityDirectors.modalityId })
    .from(modalityDirectors)
    .where(eq(modalityDirectors.userId, userId));
  return rows.map((row) => row.modalityId);
}

export async function listModalities(db: DbClient): Promise<ModalityRow[]> {
  return db.select().from(modalities);
}

export async function findModalityById(db: DbClient, id: string): Promise<ModalityRow | undefined> {
  const [row] = await db.select().from(modalities).where(eq(modalities.id, id)).limit(1);
  return row;
}

export async function createModality(
  db: DbClient,
  values: Pick<ModalityRow, 'name' | 'sport' | 'category'>,
): Promise<ModalityRow> {
  const [row] = await db.insert(modalities).values(values).returning();
  if (!row) throw new Error('Failed to create modality');
  return row;
}

export async function updateModality(
  db: DbClient,
  id: string,
  values: Partial<Pick<ModalityRow, 'name' | 'sport' | 'category' | 'active'>>,
): Promise<ModalityRow> {
  const [row] = await db
    .update(modalities)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(modalities.id, id))
    .returning();
  if (!row) throw new Error('Modality not found');
  return row;
}

export async function listTeamsByModality(db: DbClient, modalityId: string): Promise<TeamRow[]> {
  return db.select().from(teams).where(eq(teams.modalityId, modalityId));
}

export async function findTeamById(db: DbClient, id: string): Promise<TeamRow | undefined> {
  const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return row;
}

export async function createTeam(
  db: DbClient,
  values: Pick<TeamRow, 'modalityId' | 'name'>,
): Promise<TeamRow> {
  const [row] = await db.insert(teams).values(values).returning();
  if (!row) throw new Error('Failed to create team');
  return row;
}

export async function updateTeam(
  db: DbClient,
  id: string,
  values: Partial<Pick<TeamRow, 'name'>>,
): Promise<TeamRow> {
  const [row] = await db
    .update(teams)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(teams.id, id))
    .returning();
  if (!row) throw new Error('Team not found');
  return row;
}

export async function addModalityDirector(
  db: DbClient,
  userId: string,
  modalityId: string,
): Promise<void> {
  await db.insert(modalityDirectors).values({ userId, modalityId }).onConflictDoNothing();
}

export async function removeModalityDirector(
  db: DbClient,
  userId: string,
  modalityId: string,
): Promise<void> {
  await db
    .delete(modalityDirectors)
    .where(and(eq(modalityDirectors.userId, userId), eq(modalityDirectors.modalityId, modalityId)));
}
