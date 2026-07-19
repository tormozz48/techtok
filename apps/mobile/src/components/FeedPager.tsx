import type { Card as CardData } from '@techtok/shared';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Card } from './Card';

export interface FeedPagerProps {
  cards: CardData[];
  onNearEnd?: () => void;
}

const NEAR_END_THRESHOLD = 5;

export function FeedPager({ cards, onNearEnd }: FeedPagerProps) {
  return (
    <PagerView
      style={styles.pager}
      orientation="vertical"
      offscreenPageLimit={1}
      onPageSelected={(event) => {
        const isNearEnd = event.nativeEvent.position >= cards.length - NEAR_END_THRESHOLD;
        if (isNearEnd) onNearEnd?.();
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
