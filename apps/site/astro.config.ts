import { LANGUAGES } from '@techtok/shared';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://techtokapp.eu',
  i18n: {
    defaultLocale: 'en',
    locales: [...LANGUAGES],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
