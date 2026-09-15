import { eq } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { membershipDues } from '../../database/schema/index.js';
import type { membershipDues as MembershipDuesTable } from '../../database/schema/index.js';

export type MembershipDuesRow = typeof MembershipDuesTable.$inferSelect;

export async function listDuesForAthlete(
  db: DbClient,
  athleteId: string,
): Promise<MembershipDuesRow[]> {
  return db.select().from(membershipDues).where(eq(membershipDues.athleteId, athleteId));
}

export async function upsertDues(
  db: DbClient,
  values: {
    athleteId: string;
    semester: string;
    paymentStatus: MembershipDuesRow['paymentStatus'];
    markedBy: string;
  },
): Promise<MembershipDuesRow> {
  const [row] = await db
    .insert(membershipDues)
    .values(values)
    .onConflictDoUpdate({
      target: [membershipDues.athleteId, membershipDues.semester],
      set: {
        paymentStatus: values.paymentStatus,
        markedBy: values.markedBy,
        markedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error('Failed to upsert membership dues');
  return row;
}
