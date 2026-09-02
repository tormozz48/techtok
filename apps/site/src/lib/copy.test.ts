import { LANGUAGES } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { SITE_COPY } from './copy';

describe('SITE_COPY', () => {
  it('has copy for every app language', () => {
    for (const lang of LANGUAGES) {
      expect(SITE_COPY[lang]).toBeDefined();
    }
  });

  it('lists the same number of feature items in every language', () => {
    const lengths = LANGUAGES.map((lang) => SITE_COPY[lang].features.items.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('has no empty leaf strings in any language', () => {
    for (const lang of LANGUAGES) {
      expect(findEmptyLeaves(SITE_COPY[lang])).toEqual([]);
    }
  });
});

function findEmptyLeaves(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return value.trim().length === 0 ? [path] : [];
  }
  if (typeof value === 'function') {
    const sample = (value as (...args: string[]) => string)('1.0.0');
    return findEmptyLeaves(sample, path);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findEmptyLeaves(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, val]) =>
      findEmptyLeaves(val, path ? `${path}.${key}` : key),
    );
  }
  return [];
}
