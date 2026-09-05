import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/*/src/**/*.test.ts',
            'packages/*/scripts/**/*.test.ts',
            'scripts/**/*.test.ts',
            'apps/site/src/**/*.test.ts',
          ],
          exclude: [...configDefaults.exclude, 'packages/e2e/**'],
          hookTimeout: 30_000,
        },
      },
      './apps/mobile/vitest.config.ts',
    ],
  },
});
