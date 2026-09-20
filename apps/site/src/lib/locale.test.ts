import { describe, expect, it } from 'vitest';
import { localeHref, localizedHref, localizedPath, withBase } from './locale';

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

describe('localizedPath', () => {
  it('leaves the default language without a locale segment', () => {
    expect(localizedPath('en', 'test/')).toBe('test/');
  });

  it('prefixes the locale segment for the other languages', () => {
    expect(localizedPath('ru', 'test/')).toBe('ru/test/');
    expect(localizedPath('uk', 'test/')).toBe('uk/test/');
    expect(localizedPath('pl', 'test/')).toBe('pl/test/');
  });
});

describe('localizedHref', () => {
  it('builds a per-locale href for a subpage', () => {
    expect(localizedHref('en', 'test/', '/')).toBe('/test/');
    expect(localizedHref('pl', 'test/', '/')).toBe('/pl/test/');
  });

  it('keeps working under a project base path', () => {
    expect(localizedHref('en', 'test/', '/techtok')).toBe('/techtok/test/');
    expect(localizedHref('ru', 'test/', '/techtok')).toBe('/techtok/ru/test/');
  });
});
