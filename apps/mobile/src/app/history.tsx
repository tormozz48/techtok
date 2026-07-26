import { useInfiniteQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { List, Searchbar } from 'react-native-paper';
import { fetchHistoryPage } from '@/api/client';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { timeAgo } from '@/utils/timeAgo';

export default function HistoryScreen() {
  const [searchText, setSearchText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { data, isLoading, isError, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['history', submittedQuery],
    queryFn: ({ pageParam }) =>
      fetchHistoryPage({ cursor: pageParam, q: submittedQuery || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const strings = useStrings();

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const isSearching = submittedQuery.length > 0;

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={strings.history.searchPlaceholder}
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={() => setSubmittedQuery(searchText.trim())}
        onClearIconPress={() => setSubmittedQuery('')}
        style={styles.searchbar}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{strings.history.error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {isSearching ? strings.history.noResults : strings.history.empty}
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item) => item.postId}
          onEndReached={() => {
            if (!isSearching && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <List.Item
              title={item.cardTitle}
              titleStyle={styles.title}
              titleNumberOfLines={2}
              description={`${item.sourceName} · ${timeAgo(item.readAt)}`}
              descriptionStyle={styles.metaText}
              onPress={() => WebBrowser.openBrowserAsync(item.url)}
              style={styles.row}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  searchbar: {
    margin: Spacing.three,
    backgroundColor: Colors.dark.backgroundElement,
  },
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
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
