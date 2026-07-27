import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {},
  },
  // expo-modules-core ships a `ts-declarations/` folder of ambient-only
  // `.ts` files (no real runtime exports, only `declare global` type
  // augmentation) referenced via ordinary `import { X } from './X'`
  // statements meant to be erased by a real tsc typecheck. Metro/Babel elide
  // them; Vite's per-file dev transform can't always tell they're type-only
  // and keeps the import, and the browser's ESM loader then throws
  // "does not provide an export named X" at link time. Bundling them instead
  // (rolldown's dependency-optimization step, with shimMissingExports so a
  // genuinely-missing named export becomes `undefined` rather than a hard
  // error) sidesteps the strict per-file ESM linking check.
  async viteFinal(viteConfig) {
    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.rolldownOptions = {
      ...viteConfig.optimizeDeps.rolldownOptions,
      shimMissingExports: true,
    };

    // Stories render outside expo-router's navigation tree, so the real
    // package — and the Metro-only expo dev-client bootstrap it drags in —
    // never needs to load. See .storybook/mocks/expo-router.tsx.
    viteConfig.resolve ??= {};
    const expoRouterMock = path.resolve(dirname, 'mocks/expo-router.tsx');
    viteConfig.resolve.alias = Array.isArray(viteConfig.resolve.alias)
      ? [...viteConfig.resolve.alias, { find: 'expo-router', replacement: expoRouterMock }]
      : { ...viteConfig.resolve.alias, 'expo-router': expoRouterMock };

    return viteConfig;
  },
};

export default config;
