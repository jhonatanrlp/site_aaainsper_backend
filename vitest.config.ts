import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Integration tests need a real Postgres and their own runner
    // (vitest.integration.config.ts / npm run test:integration).
    exclude: ['**/node_modules/**', 'src/test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/database/migrations/**'],
    },
  },
});
