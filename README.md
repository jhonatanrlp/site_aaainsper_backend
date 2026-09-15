# site_aaainsper_backend

Backend API for the Atlética Insper club-management system. Ground-up rewrite — see
[the architecture note](#architecture) below for how this replaces the legacy setup.

> **Status:** in progress (Checkpoint B — core domain modules landed and revised: users,
> modalities/teams, athletes, documents, competitions, store, dues, econo, audit — 44 endpoints,
> all with server-side authorization and negative-path tests. ECONO standings are fully derived
> per format (see below); `GET /athletes/:id` returns real detail; `PATCH /users/me` is a true
> partial update). This README will be expanded as each phase lands; the full reference (data
> model, every endpoint, auth/authorization explanation, deployment) is written at the end of
> the rewrite.

## Architecture

```
site_aaainsper_frontend (React+TS+Vite)
        |
        | HTTPS REST API (JSON) — Authorization: Bearer <Supabase access token>
        v
site_aaainsper_backend (this repo — Node+TS+Fastify)
        |
        +---- Postgres (Supabase-hosted DB, backend-only access, Drizzle ORM)
        +---- Supabase Auth (identity/session — this backend only verifies tokens)
        +---- Supabase Storage (private document bucket, backend-only, service role)
```

The frontend never talks to Postgres or Storage directly. It uses Supabase Auth directly only
for login/session (OTP request/verify, token refresh — all handled by `supabase-js`'s auth
client) and calls this backend for everything else. This backend is the sole authority for
authorization: every access token is verified against Supabase to establish _identity_, then
the caller's role is looked up from **our own** `users` table to decide _what they can do_.

## Stack

- Node.js + TypeScript (strict), ESM
- [Fastify](https://fastify.dev/) — HTTP framework
- [Zod](https://zod.dev/) — request/response validation
- [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` — schema, migrations, queries
- `postgres` (postgres.js) — Postgres driver
- `@supabase/supabase-js` (service role, backend-only) — Auth token verification + Storage
- `@fastify/swagger` + `swagger-ui` — OpenAPI docs at `/docs`, also used to generate the
  frontend's typed API client
- Vitest — unit/integration tests
- ESLint + Prettier

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm run db:migrate     # applies the Drizzle migrations in src/database/migrations
npm run dev            # starts the API on http://localhost:3000 (OpenAPI docs at /docs)
```

## Environment variables

See [.env.example](.env.example) for the full list with descriptions. In short:

| Variable                                     | Purpose                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | Postgres connection string (Supabase project's pooled connection string)                      |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Used only to verify user tokens and access private Storage — never exposed to the frontend    |
| `ALLOWED_ORIGINS`                            | CORS allowlist — the frontend's origin(s)                                                     |
| `ALLOWED_EMAIL_DOMAIN`                       | Real (server-side) enforcement of who may log in — the frontend's own domain check is UX only |

## Scripts

| Command                                     | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                               | Start the API with hot reload                        |
| `npm run build` / `npm start`               | Production build (esbuild bundle) / run it           |
| `npm run typecheck`                         | `tsc --noEmit`                                       |
| `npm run lint` / `lint:fix`                 | ESLint                                               |
| `npm run format` / `format:check`           | Prettier                                             |
| `npm test` / `test:watch` / `test:coverage` | Vitest                                               |
| `npm run db:generate`                       | Generate a new Drizzle migration from schema changes |
| `npm run db:migrate`                        | Apply pending migrations                             |
| `npm run db:studio`                         | Open Drizzle Studio against `DATABASE_URL`           |

CI (`.github/workflows/ci.yml`) runs format-check, lint, typecheck, migrations against a real
Postgres service container, tests, and build on every push/PR — the pipeline fails on any of
these.

## Authentication & authorization

1. Frontend calls Supabase Auth directly for OTP login; Supabase issues/refreshes the session.
2. Frontend calls `POST /auth/session/bootstrap` once after login (`Authorization: Bearer
<Supabase access token>`) — this backend verifies the token, checks the email domain
   (`ALLOWED_EMAIL_DOMAIN`, the real enforcement point), and provisions/returns the local user
   row (role defaults to `atleta` on first login).
3. Every other request carries the same bearer token. A Fastify `preHandler` verifies it against
   Supabase (`auth.getUser`, briefly cached) to get identity, then loads the caller's `role` from
   our own `users` table (also briefly cached) — this repo's database is the source of truth for
   _what a user can do_, Supabase is the source of truth for _who they are_.
4. Route guards (`requireRole`, `requireModalityAccess`) map directly to the product's ATLETA /
   DM / GESTAO permission model — a DM only ever gets access to modalities they direct.

## Project layout

```
src/
  config/       env loading + validation
  database/     Drizzle client, schema (one file per domain), migrations
  modules/      one folder per domain (auth, users, athletes, modalities, teams,
                documents, competitions, store, dues, econo, audit) — each with
                controller / service / repository / schema / routes
  middleware/   auth verification, role/modality guards, centralized error handler
  shared/       cross-cutting types/utilities (errors, small TTL cache, Supabase client)
```

## Testing

Two separate suites:

- `npm test` — Vitest unit tests. Every external dependency (Supabase, the database) is mocked,
  so these run without any real infrastructure. Every role-gated module includes negative-path
  security tests (e.g. an athlete accessing another athlete's data, a DM crossing into a modality
  they don't direct, a user attempting to self-escalate their role) — these are required, not
  optional.
- `npm run test:integration` — Vitest against a **real** Postgres (set `DATABASE_URL` to one with
  the migrations applied). Mocks can't prove a `CHECK` constraint actually rejects bad data, that
  a partial unique index actually blocks a duplicate pending request, or that `SELECT ... FOR
UPDATE` actually serializes two concurrent stock reservations — these tests exercise the real
  transactions and real constraints instead. CI runs this against its Postgres service container
  after applying migrations; see `.github/workflows/ci.yml`.
