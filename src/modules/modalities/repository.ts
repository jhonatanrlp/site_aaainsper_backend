import { and, eq } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { modalityDirectors } from '../../database/schema/index.js';

export async function isDirectorOfModality(userId: string, modalityId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: modalityDirectors.userId })
    .from(modalityDirectors)
    .where(and(eq(modalityDirectors.userId, userId), eq(modalityDirectors.modalityId, modalityId)))
    .limit(1);
  return row !== undefined;
}
