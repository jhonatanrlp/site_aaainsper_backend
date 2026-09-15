import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { reservationStatusEnum, stockMovementReasonEnum } from './enums.js';
import { timestamps } from './shared.js';
import { users } from './users.js';

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    priceCents: integer('price_cents').notNull(),
    imageUrl: text('image_url'),
    stock: integer('stock').notNull().default(0),
    active: boolean('active').notNull().default(true),
    featured: boolean('featured').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    check('products_price_cents_check', sql`${table.priceCents} >= 0`),
    check('products_stock_check', sql`${table.stock} >= 0`),
  ],
);

// Append-only ledger. products.stock is only ever changed inside the same
// transaction as an insert here, under a row lock on the product — see
// modules/store/service.ts for the concurrency-safe reservation flow.
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: stockMovementReasonEnum('reason').notNull(),
  referenceId: uuid('reference_id'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamps.createdAt,
});

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').references(() => users.id),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone').notNull(),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    ...timestamps,
  },
  (table) => [check('reservations_quantity_check', sql`${table.quantity} > 0`)],
);
