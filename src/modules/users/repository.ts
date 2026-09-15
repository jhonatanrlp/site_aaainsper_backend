import { eq } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { users } from '../../database/schema/index.js';
import type { users as UsersTable } from '../../database/schema/index.js';

export type UserRow = typeof UsersTable.$inferSelect;

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

// Called once after a successful Supabase login (POST /auth/session/bootstrap).
// Creates the local authorization row on first login (role defaults to
// 'atleta'); on subsequent logins this is a no-op read.
export async function upsertUserFromAuth(params: { id: string; email: string }): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({ id: params.id, email: params.email })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: params.email },
    })
    .returning();

  if (!row) {
    throw new Error('Failed to upsert user');
  }

  return row;
}
