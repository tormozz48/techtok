import type { Card as CardData } from '@techtok/shared';

export const PREFETCH_IMAGE_COUNT = 3;

export function selectImagesToPrefetch(
  cards: CardData[],
  position: number,
  count = PREFETCH_IMAGE_COUNT,
): string[] {
  const urls: string[] = [];
  for (let i = position + 1; i < cards.length && urls.length < count; i++) {
    const url = cards[i]?.imageUrl;
    if (url) urls.push(url);
  }
  return urls;
}
