import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  isLikelyDuplicateTitle,
  normalizeTitle,
  tokenSetJaccard,
} from './titleSimilarity';

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeTitle('  Hello,   World!!  ')).toBe('hello world');
  });
});

describe('tokenSetJaccard', () => {
  it('is 1 for identical titles', () => {
    expect(tokenSetJaccard('Big Tech Layoffs Hit Again', 'big tech layoffs hit again')).toBe(1);
  });

  it('is 0 for completely unrelated titles', () => {
    expect(tokenSetJaccard('Scientists discover new exoplanet', 'Local bakery wins award')).toBe(0);
  });

  it('scores partial overlap between differently-worded headlines for the same story', () => {
    // normalized tokens: 8 in the first title, 9 in the second, 8 shared
    // (the second just adds "new") -> intersection 8 / union 9 = 0.888...
    const score = tokenSetJaccard(
      'Company X raises 50 million in funding round',
      'Company X raises 50 million in new funding round',
    );
    expect(score).toBeCloseTo(8 / 9);
  });

  it('is 0 when either title is empty after normalization', () => {
    expect(tokenSetJaccard('', 'Something')).toBe(0);
    expect(tokenSetJaccard('!!!', 'Something')).toBe(0);
  });
});

describe('isLikelyDuplicateTitle', () => {
  it('uses the default threshold', () => {
    expect(isLikelyDuplicateTitle('Big Tech Layoffs Hit Again', 'big tech layoffs hit again')).toBe(
      true,
    );
    expect(isLikelyDuplicateTitle('Scientists discover exoplanet', 'Local bakery wins award')).toBe(
      false,
    );
  });

  it('honors a custom threshold at the boundary', () => {
    const score = tokenSetJaccard('a b c d', 'a b x y');
    expect(isLikelyDuplicateTitle('a b c d', 'a b x y', score)).toBe(true);
    expect(isLikelyDuplicateTitle('a b c d', 'a b x y', score + 0.01)).toBe(false);
  });

  it('confirms the exported default matches DEFAULT_SIMILARITY_THRESHOLD', () => {
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
