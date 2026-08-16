import { describe, expect, it } from 'vitest';
import { firstImageSrc, toExcerpt } from './htmlText';

describe('toExcerpt', () => {
  it('returns an empty string for missing input', () => {
    expect(toExcerpt(undefined)).toBe('');
  });

  it('strips tags and decodes entities', () => {
    expect(toExcerpt('<p>Tom &amp; Jerry&#8217;s <b>show</b></p>')).toBe('Tom & Jerry’s show');
  });

  it('collapses whitespace from multi-line HTML', () => {
    expect(toExcerpt('<p>Line one</p>\n<p>Line two</p>')).toBe('Line one Line two');
  });

  it('truncates long text to maxLength and adds an ellipsis', () => {
    const long = 'a'.repeat(300);
    const excerpt = toExcerpt(long, 280);
    expect(excerpt.length).toBe(280);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('leaves short text untouched', () => {
    expect(toExcerpt('short text', 280)).toBe('short text');
  });
});

describe('firstImageSrc', () => {
  it('extracts the first img src from HTML content', () => {
    const html = '<figure><img alt="x" src="https://example.com/a.jpg" /></figure>';
    expect(firstImageSrc(html)).toBe('https://example.com/a.jpg');
  });

  it('decodes entities in the src attribute', () => {
    const html = '<img src="https://example.com/a.jpg?a=1&#038;b=2" />';
    expect(firstImageSrc(html)).toBe('https://example.com/a.jpg?a=1&b=2');
  });

  it('returns undefined when there is no img tag', () => {
    expect(firstImageSrc('<p>no image here</p>')).toBeUndefined();
  });

  it('returns undefined for missing input', () => {
    expect(firstImageSrc(undefined)).toBeUndefined();
  });
});
