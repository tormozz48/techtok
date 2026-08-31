import type { Card as CardData } from '@techtok/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { logEvent } from '@/state/eventsQueue';
import { useHapticsStore } from '@/state/hapticsStore';
import { getIsWifi } from '@/state/network';
import { enqueueRead } from '@/state/readQueue';
import { Card } from './Card';
import { selectImagesToPrefetch } from './prefetch';

export interface FeedPagerProps {
  cards: CardData[];
  onNearEnd?: () => void;
  onPageChange?: (card: CardData) => void;
}

const NEAR_END_THRESHOLD = 5;
const SETTLE_DELAY_MS = 1500;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});

export function FeedPager({ cards, onNearEnd, onPageChange }: FeedPagerProps) {
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <PagerView
      style={styles.pager}
      orientation="vertical"
      offscreenPageLimit={1}
      initialPage={0}
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
            logEvent('card_settled', { postId: card.id, primaryTopic: card.primaryTopic });
            if (useHapticsStore.getState().enabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
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
