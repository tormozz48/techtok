import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteBookmark, fetchBookmarksPage } from '@/api/client';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { timeAgo } from '@/utils/timeAgo';

export default function SavedScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarksPage({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const removeBookmark = async (postId: string) => {
    queryClient.setQueryData(['bookmarks'], (current: typeof data) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.postId !== postId),
        })),
      };
    });
    try {
      await deleteBookmark(postId);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    }
  };

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
        <Text style={styles.emptyText}>Failed to load saved posts.</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Nothing saved yet — bookmark a card from the feed.</Text>
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
        <View style={styles.row}>
          <Pressable
            style={styles.rowContent}
            onPress={() => WebBrowser.openBrowserAsync(item.url)}
          >
            <Text style={styles.title} numberOfLines={2}>
              {item.cardTitle}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.sourceName}</Text>
              <Text style={styles.metaText}> · {timeAgo(item.bookmarkedAt)}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.removeButton}
            hitSlop={8}
            onPress={() => removeBookmark(item.postId)}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </Pressable>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: Colors.dark.backgroundElement,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
  },
  rowContent: {
    flex: 1,
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
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.two,
  },
  removeButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
