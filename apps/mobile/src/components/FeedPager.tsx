import type { Card as CardData } from '@techtok/shared';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { enqueueRead } from '@/state/readQueue';
import { Card } from './Card';

export interface FeedPagerProps {
  cards: CardData[];
  onNearEnd?: () => void;
}

const NEAR_END_THRESHOLD = 5;
const SETTLE_DELAY_MS = 1500;

export function FeedPager({ cards, onNearEnd }: FeedPagerProps) {
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

        const card = cards[position];
        if (card) {
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
