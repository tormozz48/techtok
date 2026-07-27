import type { StorybookConfig } from '@storybook/react-native-web-vite';

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
    return viteConfig;
  },
};

export default config;
