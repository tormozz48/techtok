import { defineConfig } from 'astro/config';

// Deployed to GitHub Pages at https://tormozz48.github.io/techtok/ (D39) by
// .github/workflows/deploy-site.yml, the final stage of ci.yml's release
// pipeline. Astro's i18n config only standardizes URL shape + helper
// functions (getRelativeLocaleUrl etc.) — the actual per-locale pages still
// live under src/pages/[lang]/ and src/pages/index.astro.
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
