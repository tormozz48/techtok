import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { BookmarksResponse, FeedResponse, Topic } from '@techtok/shared';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from 'react-native-paper';
import { createBookmark, deleteBookmark } from '@/api/client';
import { ActionIconSize, Colors } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';
import { useLanguageStore } from '@/state/languageStore';

export interface BookmarkButtonProps {
  postId: string;
  isBookmarked?: boolean;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  snapshot?: {
    cardTitle: string;
    sourceName: string;
    url: string;
    primaryTopic?: Topic;
  };
  onToggled?: (isBookmarked: boolean) => void;
}

const DEFAULT_BOOKMARKS_QUERY_KEY = ['bookmarks', ''];

function patchBookmarksListOnCreate(
  queryClient: QueryClient,
  postId: string,
  snapshot: NonNullable<BookmarkButtonProps['snapshot']>,
): void {
  queryClient.setQueryData<InfiniteData<BookmarksResponse>>(
    DEFAULT_BOOKMARKS_QUERY_KEY,
    (current) => {
      if (!current) return current;
      const [firstPage, ...restPages] = current.pages;
      if (!firstPage) return current;
      return {
        ...current,
        pages: [
          {
            ...firstPage,
            items: [
              {
                postId,
                bookmarkedAt: new Date().toISOString(),
                cardTitle: snapshot.cardTitle,
                sourceName: snapshot.sourceName,
                url: snapshot.url,
                primaryTopic: snapshot.primaryTopic,
              },
              ...firstPage.items.filter((item) => item.postId !== postId),
            ],
          },
          ...restPages,
        ],
      };
    },
  );
}

function patchBookmarksListOnRemove(queryClient: QueryClient, postId: string): void {
  queryClient.setQueryData<InfiniteData<BookmarksResponse>>(
    DEFAULT_BOOKMARKS_QUERY_KEY,
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.postId !== postId),
        })),
      };
    },
  );
}

function patchFeedBookmarkState(
  queryClient: QueryClient,
  postId: string,
  isBookmarked: boolean,
): void {
  const language = useLanguageStore.getState().language;
  queryClient.setQueryData<InfiniteData<FeedResponse>>(['feed', language], (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === postId ? { ...item, isBookmarked } : item)),
      })),
    };
  });
}

export function BookmarkButton({
  postId,
  isBookmarked,
  iconColor = Colors.overlay.text,
  style,
  testID,
  snapshot,
  onToggled,
}: BookmarkButtonProps) {
  const queryClient = useQueryClient();
  const strings = useStrings();
  const overlayValue = useBookmarksOverlay((state) => state.overlay[postId]);
  const setOptimistic = useBookmarksOverlay((state) => state.setOptimistic);
  const clearOptimistic = useBookmarksOverlay((state) => state.clear);

  const bookmarked = overlayValue ?? isBookmarked ?? false;

  const toggle = async () => {
    const next = !bookmarked;
    setOptimistic(postId, next);
    try {
      if (next) {
        await createBookmark(postId);
        if (snapshot) patchBookmarksListOnCreate(queryClient, postId, snapshot);
      } else {
        await deleteBookmark(postId);
        patchBookmarksListOnRemove(queryClient, postId);
      }
      patchFeedBookmarkState(queryClient, postId, next);
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      onToggled?.(next);
      clearOptimistic(postId);
    } catch {
      setOptimistic(postId, bookmarked);
    }
  };

  return (
    <IconButton
      icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
      iconColor={iconColor}
      size={ActionIconSize}
      style={style}
      testID={testID}
      onPress={toggle}
      accessibilityLabel={bookmarked ? strings.a11y.bookmarkRemove : strings.a11y.bookmarkAdd}
    />
  );
}
