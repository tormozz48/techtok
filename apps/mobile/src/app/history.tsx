import { useInfiniteQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchHistoryPage } from '@/api/client';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { timeAgo } from '@/utils/timeAgo';

export default function HistoryScreen() {
  const { data, isLoading, isError, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['history'],
    queryFn: ({ pageParam }) => fetchHistoryPage({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const strings = useStrings();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

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
        <Text style={styles.emptyText}>{strings.history.error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.history.empty}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.postId}
      onEndReached={() => {
        if (!isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => WebBrowser.openBrowserAsync(item.url)}>
          <Text style={styles.title} numberOfLines={2}>
            {item.cardTitle}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>{item.sourceName}</Text>
            <Text style={styles.metaText}> · {timeAgo(item.readAt)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  row: {
    borderBottomColor: Colors.dark.backgroundElement,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
