import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import type { Plugin } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Metro (and Jest) resolve a static-image `require('./foo.png')` into a
// native asset descriptor; Vite has no equivalent for plain source files
// and leaves the bare `require` call untouched, which throws
// "require is not defined" in the browser (see LoadingScreen.tsx, the only
// place this pattern is used). This rewrites that one call shape into
// Vite's own recommended URL-asset pattern — same relative-path semantics,
// resolved per-file via import.meta.url — without touching the component
// itself (Metro/Jest still see the original `require()`).
function staticImageRequireToUrl(): Plugin {
  return {
    name: 'techtok-static-image-require-to-url',
    transform(code, id) {
      if (id.includes('node_modules') || !/\/src\/.*\.tsx?$/.test(id)) return null;
      if (!code.includes('require(')) return null;
      const transformed = code.replace(
        /require\((['"])(\.[^'"]+\.(?:png|jpe?g|gif|webp))\1\)/g,
        (_match, quote: string, assetPath: string) =>
          `new URL(${quote}${assetPath}${quote}, import.meta.url).href`,
      );
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

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
    viteConfig.plugins = [...(viteConfig.plugins ?? []), staticImageRequireToUrl()];

    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.rolldownOptions = {
      ...viteConfig.optimizeDeps.rolldownOptions,
      shimMissingExports: true,
    };

    // Stories render outside expo-router's navigation tree, so the real
    // package — and the Metro-only expo dev-client bootstrap it drags in —
    // never needs to load. See .storybook/mocks/expo-router.tsx. Same class
    // of gap for react-native-pager-view (no web view manager at all) and
    // expo-speech/expo-web-browser (their JS wrappers call
    // requireNativeModule() for a module with no `.web` implementation,
    // which throws synchronously on import in a browser).
    viteConfig.resolve ??= {};
    const mockedModules: Record<string, string> = {
      'expo-router': path.resolve(dirname, 'mocks/expo-router.tsx'),
      'react-native-pager-view': path.resolve(dirname, 'mocks/react-native-pager-view.tsx'),
      'expo-speech': path.resolve(dirname, 'mocks/expo-speech.ts'),
      'expo-web-browser': path.resolve(dirname, 'mocks/expo-web-browser.ts'),
    };
    const aliasEntries = Object.entries(mockedModules).map(([find, replacement]) => ({
      find,
      replacement,
    }));
    viteConfig.resolve.alias = Array.isArray(viteConfig.resolve.alias)
      ? [...viteConfig.resolve.alias, ...aliasEntries]
      : { ...viteConfig.resolve.alias, ...mockedModules };

    return viteConfig;
  },
};

export default config;
