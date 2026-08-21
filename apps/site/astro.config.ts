import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tormozz48.github.io',
  base: '/techtok',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'uk', 'pl'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
