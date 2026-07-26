import type { Card as CardData } from '@techtok/shared';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useFeedQuery } from '@/api/useFeedQuery';
import { BottomActionBar } from '@/components/BottomActionBar';
import { FeedPager } from '@/components/FeedPager';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';

export default function FeedScreen() {
  const { data, isLoading, isError, refetch, fetchNextPage, isFetchingNextPage } = useFeedQuery();
  const [activeCard, setActiveCard] = useState<CardData | undefined>(undefined);
  const strings = useStrings();

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  // Keeps the action bar's per-card actions in sync with the visible card
  // without waiting for a swipe: seeds activeCard on first load, and
  // re-seeds it if the feed is fully replaced (e.g. a topic/language change)
  // while the old activeCard no longer exists in the new set. A plain
  // `activeCard ?? cards[0]` fallback only covered the very first render.
  useEffect(() => {
    setActiveCard((current) => {
      if (cards.length === 0) return undefined;
      if (!current || !cards.some((card) => card.id === current.id)) {
        return cards[0];
      }
      return current;
    });
  }, [cards]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{strings.feed.error}</Text>
        <Button mode="contained" onPress={() => refetch()} style={styles.retryButton}>
          {strings.feed.retry}
        </Button>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.feed.empty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FeedPager
        cards={cards}
        onPageChange={setActiveCard}
        onNearEnd={() => {
          if (!isFetchingNextPage) fetchNextPage();
        }}
      />
      {isFetchingNextPage ? (
        <View style={styles.fetchingIndicator} pointerEvents="none">
          <ActivityIndicator color={Colors.overlay.text} size="small" />
        </View>
      ) : null}
      <BottomActionBar activeCard={activeCard ?? cards[0]} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: 16,
  },
  retryButton: {
    marginTop: Spacing.four,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  root: {
    flex: 1,
  },
  fetchingIndicator: {
    position: 'absolute',
    top: Spacing.six,
    alignSelf: 'center',
  },
});
