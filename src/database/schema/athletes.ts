import { sql } from 'drizzle-orm';
import { pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { teamJoinRequestStatusEnum } from './enums.js';
import { timestamps } from './shared.js';
import { teams } from './modalities.js';
import { users } from './users.js';

// Thin identity row: one user may have at most one athlete record, but that
// athlete can belong to many teams/modalities at once (see athleteTeams below).
export const athletes = pgTable('athletes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export const teamJoinRequests = pgTable(
  'team_join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    status: teamJoinRequestStatusEnum('status').notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    ...timestamps,
  },
  (table) => [
    // Only one pending request per athlete+team at a time.
    uniqueIndex('team_join_requests_pending_unique')
      .on(table.athleteId, table.teamId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

// Confirmed N:N membership. Written only by the approval transaction in
// modules/athletes/service.ts — never inserted directly from a controller.
export const athleteTeams = pgTable(
  'athlete_teams',
  {
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.athleteId, table.teamId] })],
);
