import { boolean, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { modalityCategoryEnum } from './enums.js';
import { timestamps } from './shared.js';
import { users } from './users.js';

export const modalities = pgTable('modalities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sport: text('sport').notNull(),
  category: modalityCategoryEnum('category').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  modalityId: uuid('modality_id')
    .notNull()
    .references(() => modalities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ...timestamps,
});

// N:N — a director (DM) can be assigned to more than one modality.
export const modalityDirectors = pgTable(
  'modality_directors',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modalityId: uuid('modality_id')
      .notNull()
      .references(() => modalities.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.modalityId] })],
);
