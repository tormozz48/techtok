import { describe, expect, it } from 'vitest';
import { extractFigures } from './figureExtraction';

describe('extractFigures', () => {
  it('extracts a figure with its caption', () => {
    const html = `
      <p>Intro text.</p>
      <figure><img src="https://cdn.example.com/photo.jpg" width="600" height="400"><figcaption>A lab photo</figcaption></figure>
    `;
    expect(extractFigures(html)).toEqual([
      { url: 'https://cdn.example.com/photo.jpg', caption: 'A lab photo' },
    ]);
  });

  it('falls back to the alt attribute when there is no figcaption', () => {
    const html = `<img src="https://cdn.example.com/photo.jpg" alt="A robot arm">`;
    expect(extractFigures(html)).toEqual([
      { url: 'https://cdn.example.com/photo.jpg', caption: 'A robot arm' },
    ]);
  });

  it('dedups against the lead image url', () => {
    const html = `<img src="https://cdn.example.com/lead.jpg"><img src="https://cdn.example.com/other.jpg">`;
    expect(extractFigures(html, 'https://cdn.example.com/lead.jpg')).toEqual([
      { url: 'https://cdn.example.com/other.jpg', caption: undefined },
    ]);
  });

  it('skips known-generic images', () => {
    const html = `<img src="https://static.arxiv.org/icons/twitter/arxiv-logo-twitter-square.png">`;
    expect(extractFigures(html)).toEqual([]);
  });

  it('skips images below the minimum declared dimensions', () => {
    const html = `<img src="https://cdn.example.com/icon.png" width="16" height="16">`;
    expect(extractFigures(html)).toEqual([]);
  });

  it('passes through images with no declared dimensions', () => {
    const html = `<img src="https://cdn.example.com/photo.jpg">`;
    expect(extractFigures(html)).toEqual([{ url: 'https://cdn.example.com/photo.jpg' }]);
  });

  it('skips non-http(s) src values', () => {
    const html = `<img src="data:image/png;base64,aaaa">`;
    expect(extractFigures(html)).toEqual([]);
  });

  it('caps at 5 figures', () => {
    const html = Array.from(
      { length: 8 },
      (_, i) => `<img src="https://cdn.example.com/${i}.jpg">`,
    ).join('');
    expect(extractFigures(html)).toHaveLength(5);
  });
});
