import { env } from '../../config/env.js';
import { db } from '../../database/client.js';
import { ForbiddenError } from '../../shared/errors.js';
import { upsertUserFromAuth, type UserRow } from '../users/repository.js';
import type { SupabaseIdentity } from '../../middleware/auth.js';

// The client-side email check in the frontend is UX only — this is the real
// enforcement point. A Supabase account outside the allowed domain can exist
// (e.g. created some other way) but will never get a local users row here,
// so it can never act as an authorized member of the system.
export async function bootstrapSession(identity: SupabaseIdentity): Promise<UserRow> {
  const domain = identity.email.split('@')[1]?.toLowerCase();
  if (domain !== env.ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
    throw new ForbiddenError(`Only @${env.ALLOWED_EMAIL_DOMAIN} accounts are allowed`);
  }

  return upsertUserFromAuth(db, { id: identity.id, email: identity.email });
}

export function isProfileComplete(user: UserRow): boolean {
  return Boolean(user.fullName && user.cpf);
}
