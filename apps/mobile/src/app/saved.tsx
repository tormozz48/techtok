import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { IconButton, List, Searchbar } from 'react-native-paper';
import { deleteBookmark, fetchBookmarksPage } from '@/api/client';
import { ScreenState } from '@/components/ScreenState';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { timeAgo } from '@/utils/timeAgo';
import { createStyles } from './saved.styles';

export default function SavedScreen() {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { data, isLoading, isError, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['bookmarks', submittedQuery],
    queryFn: ({ pageParam }) =>
      fetchBookmarksPage({ cursor: pageParam, q: submittedQuery || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const isSearching = submittedQuery.length > 0;

  const removeBookmark = async (postId: string) => {
    queryClient.setQueryData(['bookmarks', submittedQuery], (current: typeof data) => {
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

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={strings.saved.searchPlaceholder}
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={() => setSubmittedQuery(searchText.trim())}
        onClearIconPress={() => setSubmittedQuery('')}
        style={styles.searchbar}
        testID="saved-search"
      />
      {isLoading ? (
        <ScreenState loading />
      ) : isError ? (
        <ScreenState message={strings.saved.error} />
      ) : items.length === 0 ? (
        <ScreenState message={isSearching ? strings.saved.noResults : strings.saved.empty} />
      ) : (
        <FlatList
          style={styles.list}
          testID="saved-list"
          data={items}
          keyExtractor={(item) => item.postId}
          onEndReached={() => {
            if (!isSearching && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <List.Item
                title={item.cardTitle}
                titleStyle={styles.title}
                titleNumberOfLines={2}
                description={`${item.sourceName} · ${timeAgo(item.bookmarkedAt, strings.time)}`}
                descriptionStyle={styles.metaText}
                onPress={() =>
                  router.push({
                    pathname: '/post/[id]',
                    params: {
                      id: item.postId,
                      title: item.cardTitle,
                      sourceName: item.sourceName,
                      url: item.url,
                      isBookmarked: 'true',
                    },
                  })
                }
                style={styles.rowContent}
                testID={`saved-row-${item.postId}`}
              />
              <IconButton
                icon="close"
                size={16}
                iconColor={colors.textSecondary}
                onPress={() => removeBookmark(item.postId)}
                accessibilityLabel={strings.a11y.removeSaved}
                testID={`saved-remove-${item.postId}`}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
