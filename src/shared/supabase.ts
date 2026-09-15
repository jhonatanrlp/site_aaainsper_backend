import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Service-role client, backend-only. Used to (1) verify user access tokens
// against Supabase Auth (the identity source of truth) and (2) read/write the
// private documents Storage bucket. Never exposed to the frontend.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
