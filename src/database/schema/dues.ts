import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { duesPaymentStatusEnum } from './enums.js';
import { timestamps } from './shared.js';
import { athletes } from './athletes.js';
import { users } from './users.js';

export const membershipDues = pgTable(
  'membership_dues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    semester: text('semester').notNull(),
    paymentStatus: duesPaymentStatusEnum('payment_status').notNull().default('pending'),
    markedBy: uuid('marked_by')
      .notNull()
      .references(() => users.id),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('membership_dues_athlete_semester_unique').on(table.athleteId, table.semester),
  ],
);
