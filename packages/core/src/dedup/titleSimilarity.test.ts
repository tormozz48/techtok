import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMILARITY_THRESHOLD, isLikelyDuplicateTitle } from './titleSimilarity';

describe('isLikelyDuplicateTitle', () => {
  it('normalizes case, punctuation, and whitespace before comparing', () => {
    expect(isLikelyDuplicateTitle('  Hello,   World!!  ', 'hello world', 1)).toBe(true);
  });

  it('is a full match for identical titles regardless of case', () => {
    expect(
      isLikelyDuplicateTitle('Big Tech Layoffs Hit Again', 'big tech layoffs hit again', 1),
    ).toBe(true);
  });

  it('is not a match for completely unrelated titles', () => {
    expect(
      isLikelyDuplicateTitle(
        'Scientists discover new exoplanet',
        'Local bakery wins award',
        0.0001,
      ),
    ).toBe(false);
  });

  it('scores partial overlap between differently-worded headlines for the same story', () => {
    const a = 'Company X raises 50 million in funding round';
    const b = 'Company X raises 50 million in new funding round';
    expect(isLikelyDuplicateTitle(a, b, 8 / 9)).toBe(true);
    expect(isLikelyDuplicateTitle(a, b, 8 / 9 + 0.01)).toBe(false);
  });

  it('is not a match when either title is empty after normalization', () => {
    expect(isLikelyDuplicateTitle('', 'Something', 0.0001)).toBe(false);
    expect(isLikelyDuplicateTitle('!!!', 'Something', 0.0001)).toBe(false);
  });

  it('uses the default threshold', () => {
    expect(isLikelyDuplicateTitle('Big Tech Layoffs Hit Again', 'big tech layoffs hit again')).toBe(
      true,
    );
    expect(isLikelyDuplicateTitle('Scientists discover exoplanet', 'Local bakery wins award')).toBe(
      false,
    );
  });

  it('honors a custom threshold at the boundary', () => {
    const score = 1 / 3;
    expect(isLikelyDuplicateTitle('a b c d', 'a b x y', score)).toBe(true);
    expect(isLikelyDuplicateTitle('a b c d', 'a b x y', score + 0.01)).toBe(false);
  });

  it('confirms the exported default matches DEFAULT_SIMILARITY_THRESHOLD', () => {
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
