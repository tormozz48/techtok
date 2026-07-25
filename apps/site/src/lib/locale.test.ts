import { describe, expect, it } from 'vitest';
import { localeHref, withBase } from './locale';

describe('withBase', () => {
  it('inserts a separating slash when base has none (the real Astro BASE_URL shape)', () => {
    expect(withBase('favicon.svg', '/techtok')).toBe('/techtok/favicon.svg');
  });

  it('does not double the slash when base already ends in one', () => {
    expect(withBase('favicon.svg', '/techtok/')).toBe('/techtok/favicon.svg');
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
});
