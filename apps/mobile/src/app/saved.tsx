import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { IconButton, List } from 'react-native-paper';
import { deleteBookmark, fetchBookmarksPage } from '@/api/client';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { timeAgo } from '@/utils/timeAgo';

export default function SavedScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarksPage({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const strings = useStrings();

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
        <Text style={styles.emptyText}>{strings.saved.error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{strings.saved.empty}</Text>
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
          <List.Item
            title={item.cardTitle}
            titleStyle={styles.title}
            titleNumberOfLines={2}
            description={`${item.sourceName} · ${timeAgo(item.bookmarkedAt)}`}
            descriptionStyle={styles.metaText}
            onPress={() =>
              router.push({
                pathname: '/post/[id]',
                params: {
                  id: item.postId,
                  title: item.cardTitle,
                  sourceName: item.sourceName,
                  url: item.url,
                },
              })
            }
            style={styles.rowContent}
          />
          <IconButton
            icon="close"
            size={16}
            iconColor={Colors.dark.textSecondary}
            onPress={() => removeBookmark(item.postId)}
          />
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
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
