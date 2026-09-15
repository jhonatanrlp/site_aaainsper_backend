import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createReservation } from '../../modules/store/service.js';
import { products } from '../../database/schema/index.js';
import { cleanupTestData, db, insertTestProduct, insertTestUser } from './helpers.js';

// The single most important thing to verify against a REAL database rather
// than a mock: that SELECT ... FOR UPDATE actually serializes two
// concurrent reservations for the same product, so overselling is
// impossible even under real concurrency (a mock can't exercise this —
// it never blocks).

const userIds: string[] = [];
const productIds: string[] = [];

afterAll(async () => {
  await cleanupTestData({ userIds, productIds });
});

describe('reservation stock concurrency (real transaction + row lock)', () => {
  it('exactly one of two simultaneous reservations for the last unit succeeds', async () => {
    const productId = await insertTestProduct(1);
    productIds.push(productId);
    const buyerA = await insertTestUser('atleta');
    const buyerB = await insertTestUser('atleta');
    userIds.push(buyerA.id, buyerB.id);

    const attempt = (buyer: { id: string }) =>
      createReservation({
        actor: { id: buyer.id, role: 'atleta' },
        productId,
        quantity: 1,
        contactName: 'Test Buyer',
        contactPhone: '11999999999',
      });

    const results = await Promise.allSettled([attempt(buyerA), attempt(buyerB)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [product] = await db.select().from(products).where(eq(products.id, productId));
    expect(product?.stock).toBe(0);
  });

  it('a reservation larger than available stock is rejected without changing stock', async () => {
    const productId = await insertTestProduct(2);
    productIds.push(productId);
    const buyer = await insertTestUser('atleta');
    userIds.push(buyer.id);

    await expect(
      createReservation({
        actor: { id: buyer.id, role: 'atleta' },
        productId,
        quantity: 5,
        contactName: 'Test Buyer',
        contactPhone: '11999999999',
      }),
    ).rejects.toThrow();

    const [product] = await db.select().from(products).where(eq(products.id, productId));
    expect(product?.stock).toBe(2);
  });
});
