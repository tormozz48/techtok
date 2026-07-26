import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/scripts/**/*.test.ts',
      'scripts/**/*.test.ts',
      'apps/site/src/**/*.test.ts',
    ],
    // packages/e2e hits real AWS/dev-stage resources and runs only via its
    // own vitest.config.ts (invoked by .github/workflows/e2e.yml), never as
    // part of the credential-free `pnpm test`.
    exclude: [...configDefaults.exclude, 'packages/e2e/**'],
  },
});
