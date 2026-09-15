import {
  jsonb,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  matchOutcomeEnum,
  matchSlotEnum,
  matchStatusEnum,
  tournamentModalityFormatEnum,
} from './enums.js';
import { timestamps } from './shared.js';
import { users } from './users.js';

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  season: text('season').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

// Participants (colleges) belong to the tournament — the same set competes
// across every modality within it.
export const tournamentParticipants = pgTable('tournament_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  collegeName: text('college_name').notNull(),
  logoUrl: text('logo_url'),
  ...timestamps,
});

export const tournamentModalities = pgTable('tournament_modalities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  sportName: text('sport_name').notNull(),
  format: tournamentModalityFormatEnum('format').notNull(),
  ...timestamps,
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentModalityId: uuid('tournament_modality_id')
    .notNull()
    .references(() => tournamentModalities.id, { onDelete: 'cascade' }),
  // Free-form round/group label: "QF", "SF", "Final", "3rd_place", a group name, etc.
  round: text('round').notNull(),
  status: matchStatusEnum('status').notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  ...timestamps,
});

export const matchParticipants = pgTable(
  'match_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => tournamentParticipants.id, { onDelete: 'cascade' }),
    slot: matchSlotEnum('slot').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('match_participants_match_slot_unique').on(table.matchId, table.slot)],
);

// One row per participant per match — auditable and editable (via audit_logs),
// not buried inside a JSON blob. `outcome` is always supplied explicitly by
// the caller (win/draw/loss) — never inferred, so invalid/incomplete input
// is rejected rather than silently treated as a draw.
export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => tournamentParticipants.id, { onDelete: 'cascade' }),
    score: integer('score'),
    outcome: matchOutcomeEnum('outcome').notNull(),
    // e.g. Rugby's try-count tiebreaker
    tiebreakValue: integer('tiebreak_value'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('match_results_match_participant_unique').on(table.matchId, table.participantId),
  ],
);

// For single_elimination/round_robin/grouped_round_robin, fully recomputed
// by the service layer from match_results after every result write —
// position is always derived, never hand-edited, for these three formats.
// For fixed_ranking/reorderable_ranking (no real matches), position is set
// directly via PATCH /standings — the only formats where that's allowed.
export const standings = pgTable(
  'standings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentModalityId: uuid('tournament_modality_id')
      .notNull()
      .references(() => tournamentModalities.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => tournamentParticipants.id, { onDelete: 'cascade' }),
    position: integer('position'),
    points: integer('points').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('standings_modality_participant_unique').on(
      table.tournamentModalityId,
      table.participantId,
    ),
  ],
);

// The one legitimate JSON use: named what-if snapshots, replacing the old
// localStorage save/load with a shared, multi-user feature.
export const tournamentScenarios = pgTable('tournament_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  snapshot: jsonb('snapshot').notNull(),
  ...timestamps,
});
