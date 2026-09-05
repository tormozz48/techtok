import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: { __DEV__: 'false' },
  test: {
    name: 'mobile',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    alias: [{ find: /^@\//, replacement: `${path.resolve(dirname, 'src')}/` }],
  },
});
