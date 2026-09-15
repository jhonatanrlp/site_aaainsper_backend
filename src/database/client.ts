import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const queryClient = postgres(env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

// Accepted by every repository function so services can choose to run inside
// a transaction (db.transaction(async (tx) => { ... })) or against the plain
// pooled client, without the repository layer knowing or caring which.
export type DbClient = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
