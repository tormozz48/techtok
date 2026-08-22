import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import type { Plugin } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

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
  async viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), staticImageRequireToUrl()];

    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.rolldownOptions = {
      ...viteConfig.optimizeDeps.rolldownOptions,
      shimMissingExports: true,
    };

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
