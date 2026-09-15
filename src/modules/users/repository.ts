import { and, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { users } from '../../database/schema/index.js';
import type { users as UsersTable } from '../../database/schema/index.js';

export type UserRow = typeof UsersTable.$inferSelect;

export async function findUserById(db: DbClient, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function findUserByEmail(db: DbClient, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

// Called once after a successful Supabase login (POST /auth/session/bootstrap).
// Creates the local authorization row on first login (role defaults to
// 'atleta'); on subsequent logins this is a no-op read.
export async function upsertUserFromAuth(
  db: DbClient,
  params: { id: string; email: string },
): Promise<UserRow> {
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

export async function updateOwnProfile(
  db: DbClient,
  userId: string,
  fields: Partial<
    Pick<UserRow, 'fullName' | 'cpf' | 'rg' | 'birthDate' | 'course' | 'instagram' | 'phone'>
  >,
): Promise<UserRow> {
  const [row] = await db
    .update(users)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!row) {
    throw new Error('User not found');
  }

  return row;
}

export async function updateUserRole(
  db: DbClient,
  userId: string,
  role: UserRow['role'],
  assignedBy: string,
): Promise<UserRow> {
  const [row] = await db
    .update(users)
    .set({ role, roleAssignedBy: assignedBy, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!row) {
    throw new Error('User not found');
  }

  return row;
}

export interface ListUsersParams {
  search?: string;
  limit: number;
  offset: number;
}

export async function listUsers(
  db: DbClient,
  params: ListUsersParams,
): Promise<{ rows: UserRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (params.search) {
    const term = `%${params.search}%`;
    const clause = or(ilike(users.fullName, term), ilike(users.email, term));
    if (clause) conditions.push(clause);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.select().from(users).where(where).limit(params.limit).offset(params.offset),
    db.$count(users, where),
  ]);

  return { rows, total: countResult };
}
