import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFeedQuery } from '@/api/useFeedQuery';
import { FeedPager } from '@/components/FeedPager';
import { Colors } from '@/constants/theme';

export default function FeedScreen() {
  const { data, isLoading, isError, error, fetchNextPage, isFetchingNextPage } = useFeedQuery();

  const cards = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
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
    <FeedPager
      cards={cards}
      onNearEnd={() => {
        if (!isFetchingNextPage) fetchNextPage();
      }}
    />
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
});
