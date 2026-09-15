import { boolean, date, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';
import { timestamps } from './shared.js';

// id matches the Supabase Auth user id (auth.users.id) — this table is our own
// authorization source of truth, kept in sync via POST /auth/session/bootstrap.
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  cpf: text('cpf').unique(),
  rg: text('rg'),
  birthDate: date('birth_date'),
  course: text('course'),
  instagram: text('instagram'),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('atleta'),
  roleAssignedBy: uuid('role_assigned_by').references((): AnyPgColumn => users.id),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});
