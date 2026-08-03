import type { Card as CardData } from '@techtok/shared';

export const PREFETCH_IMAGE_COUNT = 3;
export const PREFETCH_CONTENT_COUNT = 3;

/** Picks the next `count` cards' image URLs after `position`, skipping any
 * imageless cards, for prefetching ahead of the reader. */
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

/** Picks the next `count` cards' ids after `position`, for prefetching their
 * article content ahead of the reader (D61). Every card has an id, so unlike
 * selectImagesToPrefetch there's nothing to skip. */
export function selectContentToPrefetch(
  cards: CardData[],
  position: number,
  count = PREFETCH_CONTENT_COUNT,
): string[] {
  return cards.slice(position + 1, position + 1 + count).map((card) => card.id);
}
