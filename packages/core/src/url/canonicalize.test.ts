import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, contentKey } from './canonicalize';

describe('canonicalizeUrl', () => {
  it('strips utm_ and known tracking params', () => {
    const result = canonicalizeUrl(
      'https://example.com/article?utm_source=newsletter&utm_medium=email&id=42',
    );
    expect(result).toBe('https://example.com/article?id=42');
  });

  it('strips the fragment', () => {
    expect(canonicalizeUrl('https://example.com/article#section-2')).toBe(
      'https://example.com/article',
    );
  });

  it('lowercases scheme and host', () => {
    expect(canonicalizeUrl('HTTPS://Example.COM/Article')).toBe('https://example.com/Article');
  });

  it('drops a trailing slash on non-root paths', () => {
    expect(canonicalizeUrl('https://example.com/article/')).toBe('https://example.com/article');
  });

  it('keeps the root path slash', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('drops default ports', () => {
    expect(canonicalizeUrl('https://example.com:443/article')).toBe('https://example.com/article');
  });

  it('sorts remaining query params for determinism', () => {
    expect(canonicalizeUrl('https://example.com/a?b=2&a=1')).toBe('https://example.com/a?a=1&b=2');
  });

  it('leaves an already-clean URL unchanged', () => {
    const clean = 'https://queue.acm.org/detail.cfm?id=3818307';
    expect(canonicalizeUrl(clean)).toBe(clean);
  });
});

describe('contentKey', () => {
  it('is deterministic for the same input', () => {
    const url = 'https://example.com/article';
    expect(contentKey(url)).toBe(contentKey(url));
  });

  it('produces a 64-char hex sha-256 digest', () => {
    expect(contentKey('https://example.com/article')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different canonical URLs', () => {
    expect(contentKey('https://example.com/a')).not.toBe(contentKey('https://example.com/b'));
  });
});
