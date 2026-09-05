import { describe, expect, it } from 'vitest';
import { localeHref, withBase } from './locale';

describe('withBase', () => {
  it('inserts a separating slash when base has none (the real Astro BASE_URL shape)', () => {
    expect(withBase('favicon.svg', '/techtok')).toBe('/techtok/favicon.svg');
  });

  it('does not double the slash when base already ends in one', () => {
    expect(withBase('favicon.svg', '/techtok/')).toBe('/techtok/favicon.svg');
  });

  it('collapses to the bare root when the site is served from the apex (base "/")', () => {
    expect(withBase('favicon.svg', '/')).toBe('/favicon.svg');
    expect(withBase('', '/')).toBe('/');
  });
});

describe('localeHref', () => {
  it('points the default language at the base path with no locale segment', () => {
    expect(localeHref('en', '/techtok')).toBe('/techtok/');
    expect(localeHref('en', '/techtok/')).toBe('/techtok/');
  });

  it('appends the locale segment for non-default languages', () => {
    expect(localeHref('ru', '/techtok')).toBe('/techtok/ru/');
    expect(localeHref('uk', '/techtok')).toBe('/techtok/uk/');
    expect(localeHref('pl', '/techtok')).toBe('/techtok/pl/');
  });

  it('works from the apex: default language at "/", others at "/<lang>/"', () => {
    expect(localeHref('en', '/')).toBe('/');
    expect(localeHref('ru', '/')).toBe('/ru/');
  });
});
