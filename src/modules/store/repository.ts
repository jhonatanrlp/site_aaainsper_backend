import { desc, eq, and } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { products, reservations, stockMovements } from '../../database/schema/index.js';
import type {
  products as ProductsTable,
  reservations as ReservationsTable,
} from '../../database/schema/index.js';

export type ProductRow = typeof ProductsTable.$inferSelect;
export type ReservationRow = typeof ReservationsTable.$inferSelect;

export async function listProducts(db: DbClient, publicOnly: boolean): Promise<ProductRow[]> {
  if (!publicOnly) return db.select().from(products);
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.featured, true)));
}

export async function findProductById(db: DbClient, id: string): Promise<ProductRow | undefined> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row;
}

// SELECT ... FOR UPDATE — locks the row for the lifetime of the enclosing
// transaction so two concurrent reservations can't both read the same stock
// figure and both succeed.
export async function findProductForUpdate(
  db: DbClient,
  id: string,
): Promise<ProductRow | undefined> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).for('update').limit(1);
  return row;
}

export async function createProduct(
  db: DbClient,
  values: Pick<
    ProductRow,
    'name' | 'description' | 'priceCents' | 'imageUrl' | 'stock' | 'active' | 'featured'
  >,
): Promise<ProductRow> {
  const [row] = await db.insert(products).values(values).returning();
  if (!row) throw new Error('Failed to create product');
  return row;
}

export async function updateProduct(
  db: DbClient,
  id: string,
  values: Partial<
    Pick<ProductRow, 'name' | 'description' | 'priceCents' | 'imageUrl' | 'active' | 'featured'>
  >,
): Promise<ProductRow> {
  const [row] = await db
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!row) throw new Error('Product not found');
  return row;
}

export async function setProductStock(db: DbClient, id: string, stock: number): Promise<void> {
  await db.update(products).set({ stock, updatedAt: new Date() }).where(eq(products.id, id));
}

export async function insertStockMovement(
  db: DbClient,
  values: {
    productId: string;
    delta: number;
    reason: 'reservation' | 'restock' | 'cancellation' | 'adjustment';
    referenceId?: string;
    createdBy?: string;
  },
): Promise<void> {
  await db.insert(stockMovements).values(values);
}

export async function listReservations(db: DbClient): Promise<ReservationRow[]> {
  return db.select().from(reservations).orderBy(desc(reservations.createdAt));
}

export async function findReservationById(
  db: DbClient,
  id: string,
): Promise<ReservationRow | undefined> {
  const [row] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  return row;
}

export async function findReservationForUpdate(
  db: DbClient,
  id: string,
): Promise<ReservationRow | undefined> {
  const [row] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, id))
    .for('update')
    .limit(1);
  return row;
}

export async function createReservationRow(
  db: DbClient,
  values: Pick<
    ReservationRow,
    'productId' | 'userId' | 'contactName' | 'contactPhone' | 'quantity' | 'note'
  >,
): Promise<ReservationRow> {
  const [row] = await db.insert(reservations).values(values).returning();
  if (!row) throw new Error('Failed to create reservation');
  return row;
}

export async function updateReservationStatus(
  db: DbClient,
  id: string,
  status: ReservationRow['status'],
): Promise<ReservationRow> {
  const [row] = await db
    .update(reservations)
    .set({ status, updatedAt: new Date() })
    .where(eq(reservations.id, id))
    .returning();
  if (!row) throw new Error('Reservation not found');
  return row;
}
