import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'examples/*/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
