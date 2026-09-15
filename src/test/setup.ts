// Populates process.env with safe defaults before any test imports config/env.ts,
// so tests never depend on a real .env file or real Supabase/Postgres credentials
// unless a test explicitly opts into integration mode.
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.ALLOWED_ORIGINS ??= 'http://localhost:5173';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SUPABASE_DOCUMENTS_BUCKET ??= 'documents';
process.env.ALLOWED_EMAIL_DOMAIN ??= 'al.insper.edu.br';
