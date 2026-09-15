import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts (unit tests, fully mocked, no infra needed).
// These tests run against a REAL Postgres — set DATABASE_URL before running
// (see .env.example / .github/workflows/ci.yml, which provisions one as a
// service container). They verify what mocks structurally cannot: that the
// migrations actually apply, that DB-level constraints actually reject bad
// data, and that the critical transactions (team-join-request approval,
// concurrent stock reservation) behave correctly against a real database
// with real row locking.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/test/integration/**/*.integration.test.ts'],
    // Real transactions against a real connection pool can be slower than
    // mocked unit tests, especially the deliberate-concurrency ones.
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
