import type { Card as CardData } from '@techtok/shared';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFeedQuery } from '@/api/useFeedQuery';
import { BottomActionBar } from '@/components/BottomActionBar';
import { FeedPager } from '@/components/FeedPager';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Colors } from '@/constants/theme';

export default function FeedScreen() {
  const { data, isLoading, isError, error, fetchNextPage, isFetchingNextPage } = useFeedQuery();
  const [activeCard, setActiveCard] = useState<CardData | undefined>(undefined);

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load the feed.'}
        </Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No stories yet — check back after the next ingest run.</Text>
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
  emptyText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  root: {
    flex: 1,
  },
});
