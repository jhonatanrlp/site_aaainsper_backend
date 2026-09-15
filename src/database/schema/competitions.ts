import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { competitionRegistrationStatusEnum } from './enums.js';
import { timestamps } from './shared.js';
import { athletes } from './athletes.js';
import { modalities, teams } from './modalities.js';
import { users } from './users.js';

export const competitions = pgTable('competitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  season: text('season').notNull(),
  ...timestamps,
});

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  modalityId: uuid('modality_id')
    .notNull()
    .references(() => modalities.id, { onDelete: 'cascade' }),
  competitionId: uuid('competition_id').references(() => competitions.id),
  opponent: text('opponent').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  venue: text('venue'),
  home: boolean('home').notNull().default(true),
  published: boolean('published').notNull().default(false),
  ...timestamps,
});

export const competitionRegistrations = pgTable('competition_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  competitionId: uuid('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id),
  rankingLabel: text('ranking_label'),
  status: competitionRegistrationStatusEnum('status').notNull().default('draft'),
  registeredBy: uuid('registered_by')
    .notNull()
    .references(() => users.id),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  ...timestamps,
});

export const trophies = pgTable(
  'trophies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    competition: text('competition').notNull(),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [check('trophies_position_check', sql`${table.position} in (1, 2, 3)`)],
);

export const boardMembers = pgTable('board_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  roleTitle: text('role_title').notNull(),
  photoUrl: text('photo_url'),
  order: integer('order').notNull().default(0),
  ...timestamps,
});
