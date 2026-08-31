import { LANGUAGES } from '@techtok/shared';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tormozz48.github.io',
  base: '/techtok',
  i18n: {
    defaultLocale: 'en',
    locales: [...LANGUAGES],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
