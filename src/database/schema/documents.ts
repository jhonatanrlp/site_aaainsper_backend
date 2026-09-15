import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { athleteDocumentStatusEnum, requiredDocumentTypeEnum } from './enums.js';
import { timestamps } from './shared.js';
import { athletes } from './athletes.js';
import { modalities } from './modalities.js';
import { users } from './users.js';

export const requiredDocuments = pgTable('required_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  // null = applies to every modality (global requirement)
  modalityId: uuid('modality_id').references(() => modalities.id, { onDelete: 'cascade' }),
  type: requiredDocumentTypeEnum('type').notNull(),
  required: boolean('required').notNull().default(true),
  validityDays: integer('validity_days'),
  ...timestamps,
});

export const athleteDocuments = pgTable(
  'athlete_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    requiredDocumentId: uuid('required_document_id')
      .notNull()
      .references(() => requiredDocuments.id, { onDelete: 'cascade' }),
    status: athleteDocumentStatusEnum('status').notNull().default('pending'),
    storagePath: text('storage_path'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('athlete_documents_athlete_required_doc_unique').on(
      table.athleteId,
      table.requiredDocumentId,
    ),
  ],
);
