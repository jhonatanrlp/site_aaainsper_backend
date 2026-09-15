import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { db } from '../../database/client.js';
import {
  auditLogs,
  modalities,
  products,
  reservations,
  stockMovements,
  users,
  athletes,
} from '../../database/schema/index.js';

export { db };

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@al.insper.edu.br`;
}

export async function insertTestUser(
  role: 'atleta' | 'dm' | 'gestao' = 'atleta',
): Promise<{ id: string; email: string }> {
  // users.id has no default — it's meant to equal a real Supabase auth user
  // id. These tests never touch Supabase Auth, so we mint one ourselves.
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), email: uniqueEmail(role), role })
    .returning({ id: users.id, email: users.email });
  if (!row) throw new Error('failed to insert test user');
  return row;
}

export async function insertTestModality(): Promise<string> {
  const [row] = await db
    .insert(modalities)
    .values({ name: `Test Modality ${randomUUID()}`, sport: 'futsal', category: 'misto' })
    .returning({ id: modalities.id });
  if (!row) throw new Error('failed to insert test modality');
  return row.id;
}

export async function insertTestProduct(stock: number): Promise<string> {
  const [row] = await db
    .insert(products)
    .values({ name: `Test Product ${randomUUID()}`, priceCents: 1000, stock })
    .returning({ id: products.id });
  if (!row) throw new Error('failed to insert test product');
  return row.id;
}

// Deletes in an order that respects the FK graph (see schema/*.ts for
// onDelete behavior): rows with plain references to users/products/modalities
// (audit_logs, reservations, stock_movements) go first, cascading
// relationships (modalities -> teams -> ..., users -> athletes -> ...) are
// left to the DB, and users go last.
export async function cleanupTestData(params: {
  userIds?: string[];
  modalityIds?: string[];
  productIds?: string[];
}): Promise<void> {
  const userIds = params.userIds ?? [];
  const modalityIds = params.modalityIds ?? [];
  const productIds = params.productIds ?? [];

  if (userIds.length > 0) {
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, userIds));
  }
  if (productIds.length > 0) {
    await db.delete(reservations).where(inArray(reservations.productId, productIds));
    await db.delete(stockMovements).where(inArray(stockMovements.productId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
  }
  if (modalityIds.length > 0) {
    await db.delete(modalities).where(inArray(modalities.id, modalityIds));
  }
  if (userIds.length > 0) {
    await db.delete(athletes).where(inArray(athletes.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
}
