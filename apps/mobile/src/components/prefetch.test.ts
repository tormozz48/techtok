import type { Card as CardData } from '@techtok/shared';
import { selectImagesToPrefetch } from './prefetch';

function card(id: string, imageUrl?: string): CardData {
  return {
    id,
    title: id,
    summary: id,
    sourceName: 'Source',
    url: `https://example.com/${id}`,
    primaryTopic: 'dev',
    topics: ['dev'],
    publishedAt: '2026-07-18T00:00:00.000Z',
    imageUrl,
    servedLang: 'en',
    isTranslated: false,
    compactLangs: [],
  };
}

describe('selectImagesToPrefetch', () => {
  it('picks the next N image urls after position', () => {
    const cards = [card('a', 'a.jpg'), card('b', 'b.jpg'), card('c', 'c.jpg'), card('d', 'd.jpg')];

    expect(selectImagesToPrefetch(cards, 0, 2)).toEqual(['b.jpg', 'c.jpg']);
  });

  it('skips cards with no imageUrl', () => {
    const cards = [card('a'), card('b'), card('c', 'c.jpg'), card('d', 'd.jpg')];

    expect(selectImagesToPrefetch(cards, 0, 2)).toEqual(['c.jpg', 'd.jpg']);
  });

  it('stops at the end of the array without erroring', () => {
    const cards = [card('a', 'a.jpg'), card('b', 'b.jpg')];

    expect(selectImagesToPrefetch(cards, 0, 5)).toEqual(['b.jpg']);
  });

  it('returns an empty array when already at the last card', () => {
    const cards = [card('a', 'a.jpg'), card('b', 'b.jpg')];

    expect(selectImagesToPrefetch(cards, 1)).toEqual([]);
  });
});
