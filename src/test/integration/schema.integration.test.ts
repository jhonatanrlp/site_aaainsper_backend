import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  athletes,
  products,
  reservations,
  teamJoinRequests,
  teams,
  trophies,
  users,
} from '../../database/schema/index.js';
import {
  cleanupTestData,
  db,
  insertTestModality,
  insertTestProduct,
  insertTestUser,
} from './helpers.js';

// Verifies the migrations actually apply and the constraints they define
// actually reject bad data — things a mocked unit test cannot check.

const userIds: string[] = [];
const modalityIds: string[] = [];
const productIds: string[] = [];

afterAll(async () => {
  await cleanupTestData({ userIds, modalityIds, productIds });
});

describe('DB constraints', () => {
  it('rejects a product with a negative price (CHECK products_price_cents_check)', async () => {
    await expect(
      db.insert(products).values({ name: 'Bad product', priceCents: -1, stock: 0 }),
    ).rejects.toThrow();
  });

  it('rejects a product with negative stock (CHECK products_stock_check)', async () => {
    await expect(
      db.insert(products).values({ name: 'Bad product', priceCents: 100, stock: -1 }),
    ).rejects.toThrow();
  });

  it('rejects a reservation with zero or negative quantity (CHECK reservations_quantity_check)', async () => {
    const productId = await insertTestProduct(5);
    productIds.push(productId);

    await expect(
      db.insert(reservations).values({
        productId,
        contactName: 'Test',
        contactPhone: '11999999999',
        quantity: 0,
      }),
    ).rejects.toThrow();
  });

  it('rejects a trophy with an out-of-range position (CHECK trophies_position_check)', async () => {
    await expect(
      db
        .insert(trophies)
        .values({ year: 2026, competition: 'Test Cup', title: 'Champion', position: 4 }),
    ).rejects.toThrow();
  });

  it('enforces one pending team_join_request per (athlete, team) via the partial unique index', async () => {
    const user = await insertTestUser('atleta');
    userIds.push(user.id);
    const modalityId = await insertTestModality();
    modalityIds.push(modalityId);

    const [team] = await db
      .insert(teams)
      .values({ modalityId, name: 'Test Team' })
      .returning({ id: teams.id });
    if (!team) throw new Error('failed to insert test team');

    const [athlete] = await db
      .insert(athletes)
      .values({ userId: user.id })
      .returning({ id: athletes.id });
    if (!athlete) throw new Error('failed to insert test athlete');

    await db.insert(teamJoinRequests).values({ athleteId: athlete.id, teamId: team.id });

    // A second PENDING request for the same athlete+team must violate the
    // partial unique index — this is the guard against duplicate
    // applications the approval workflow relies on.
    await expect(
      db.insert(teamJoinRequests).values({ athleteId: athlete.id, teamId: team.id }),
    ).rejects.toThrow();
  });

  it('allows a new pending request once the prior one was decided (partial index only covers status=pending)', async () => {
    const user = await insertTestUser('atleta');
    userIds.push(user.id);
    const modalityId = await insertTestModality();
    modalityIds.push(modalityId);

    const [team] = await db
      .insert(teams)
      .values({ modalityId, name: 'Test Team' })
      .returning({ id: teams.id });
    if (!team) throw new Error('failed to insert test team');
    const [athlete] = await db
      .insert(athletes)
      .values({ userId: user.id })
      .returning({ id: athletes.id });
    if (!athlete) throw new Error('failed to insert test athlete');

    const [first] = await db
      .insert(teamJoinRequests)
      .values({ athleteId: athlete.id, teamId: team.id })
      .returning({ id: teamJoinRequests.id });
    if (!first) throw new Error('failed to insert first request');

    await db
      .update(teamJoinRequests)
      .set({ status: 'rejected', rejectionReason: 'test', decidedAt: new Date() })
      .where(eq(teamJoinRequests.id, first.id));

    // Now that the first request is no longer pending, a fresh one for the
    // same athlete+team must be allowed.
    await expect(
      db.insert(teamJoinRequests).values({ athleteId: athlete.id, teamId: team.id }),
    ).resolves.not.toThrow();
  });
});

describe('transaction rollback', () => {
  // Every privileged service function (approveJoinRequest, createReservation,
  // etc.) uses this exact db.transaction(async (tx) => { ... }) pattern.
  // This proves the underlying guarantee they all depend on: if anything
  // inside throws, EVERYTHING written earlier in that same transaction is
  // rolled back — not just the failing statement, and not left as a
  // partial/dirty write.
  it('rolls back an insert that already ran earlier in the same transaction when a later step throws', async () => {
    const doomedUserId = crypto.randomUUID();

    await expect(
      db.transaction(async (tx) => {
        await tx
          .insert(users)
          .values({ id: doomedUserId, email: `${doomedUserId}@al.insper.edu.br` });
        // Simulates a later step in the same transaction failing (e.g. a
        // constraint violation, or a thrown domain error) after an earlier
        // write already ran.
        throw new Error('deliberate failure after a write, to prove rollback');
      }),
    ).rejects.toThrow('deliberate failure after a write');

    const [row] = await db.select().from(users).where(eq(users.id, doomedUserId));
    expect(row).toBeUndefined();
  });
});
