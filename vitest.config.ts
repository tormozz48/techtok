import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/scripts/**/*.test.ts',
      'scripts/**/*.test.ts',
      'apps/site/src/**/*.test.ts',
    ],
  },
});
