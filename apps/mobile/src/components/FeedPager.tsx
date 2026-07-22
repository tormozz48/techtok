import type { Card as CardData } from '@techtok/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { getIsWifi } from '@/state/network';
import { enqueueRead } from '@/state/readQueue';
import { Card } from './Card';
import { selectImagesToPrefetch } from './prefetch';

export interface FeedPagerProps {
  cards: CardData[];
  onNearEnd?: () => void;
  /** Fires with the newly-active card on every page settle (D25) — drives
   * the bottom action bar's per-card bookmark/share buttons. */
  onPageChange?: (card: CardData) => void;
}

const NEAR_END_THRESHOLD = 5;
const SETTLE_DELAY_MS = 1500;

export function FeedPager({ cards, onNearEnd, onPageChange }: FeedPagerProps) {
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <PagerView
      style={styles.pager}
      orientation="vertical"
      offscreenPageLimit={1}
      onPageSelected={(event) => {
        clearTimeout(settleTimer.current);

        const { position } = event.nativeEvent;
        if (position >= cards.length - NEAR_END_THRESHOLD) onNearEnd?.();

        if (getIsWifi()) {
          for (const url of selectImagesToPrefetch(cards, position)) {
            Image.prefetch(url);
          }
        }

        const card = cards[position];
        if (card) {
          onPageChange?.(card);
          settleTimer.current = setTimeout(() => {
            enqueueRead(card.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }, SETTLE_DELAY_MS);
        }
      }}
    >
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
