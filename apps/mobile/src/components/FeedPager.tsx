import { useQueryClient } from '@tanstack/react-query';
import type { Card as CardData } from '@techtok/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { prefetchPostContent } from '@/api/prefetchContent';
import { logEvent } from '@/state/eventsQueue';
import { useLanguageStore } from '@/state/languageStore';
import { getIsWifi } from '@/state/network';
import { recordPrefetch } from '@/state/prefetchLedger';
import { enqueueRead } from '@/state/readQueue';
import { Card } from './Card';
import { selectContentToPrefetch, selectImagesToPrefetch } from './prefetch';

export interface FeedPagerProps {
  cards: CardData[];
  onNearEnd?: () => void;
  onPageChange?: (card: CardData) => void;
}

const NEAR_END_THRESHOLD = 5;
const SETTLE_DELAY_MS = 1500;

export function FeedPager({ cards, onNearEnd, onPageChange }: FeedPagerProps) {
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queryClient = useQueryClient();

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

          const language = useLanguageStore.getState().language;
          for (const postId of selectContentToPrefetch(cards, position)) {
            prefetchPostContent(queryClient, postId, language);
            for (const evicted of recordPrefetch(postId, language)) {
              queryClient.removeQueries({
                queryKey: ['content', evicted.postId, evicted.language],
              });
            }
          }
        }

        const card = cards[position];
        if (card) {
          onPageChange?.(card);
          settleTimer.current = setTimeout(() => {
            enqueueRead(card.id);
            logEvent('card_settled', { postId: card.id, primaryTopic: card.primaryTopic });
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
