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
  /** Stable E2E selector — the rendered accessibilityLabel is localized *and*
   * flips with the bookmarked state, so it can't serve as one. */
  testID?: string;
  /** Card data needed to show this bookmark in Saved immediately on create —
   * see patchBookmarksListOnCreate. Omit only where unavailable (a stale
   * Saved-list entry will still self-correct on the next invalidation). */
  snapshot?: {
    cardTitle: string;
    sourceName: string;
    url: string;
    primaryTopic?: Topic;
  };
  /** Fires with the new bookmarked state once a toggle is confirmed by the
   * server — for a caller whose own `isBookmarked` prop can't re-derive
   * itself from a live query cache (e.g. PostScreen's frozen route param,
   * unlike the feed's BottomActionBar, which re-reads the patched `['feed']`
   * cache on every render). Not called on the optimistic set or on revert;
   * only once the request actually confirms. */
  onToggled?: (isBookmarked: boolean) => void;
}

const DEFAULT_BOOKMARKS_QUERY_KEY = ['bookmarks', ''];

// GET /v1/bookmarks reads a DynamoDB GSI (byBookmarkedAt), which is only
// eventually consistent — invalidateQueries's refetch can race the write and
// come back without the item just created, leaving it missing from Saved
// until something else happens to invalidate the list again. Patching the
// cache directly (same approach as patchFeedBookmarkState below) makes the
// new bookmark show up immediately regardless of that replication lag.
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

// Patches the one affected card's isBookmarked flag directly in the cached
// feed pages instead of invalidating ['feed'] and letting it refetch — a
// refetch reflows the whole `cards` array (fresh pagination/ranking from the
// server), and FeedPager's PagerView is index-based, so the user's current
// position would end up pointing at a different card mid-toggle.
function patchFeedBookmarkState(
  queryClient: QueryClient,
  postId: string,
  isBookmarked: boolean,
): void {
  // ['feed'] is now keyed by language (useFeedQuery.ts) — an exact-key patch
  // has to name the language segment too, or this silently writes into a
  // cache slot nothing reads.
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
      // Patch the feed cache synchronously (see patchFeedBookmarkState) so
      // this card's `isBookmarked` prop is already correct once the overlay
      // clears below — no need to wait on it. Saved/[bookmarks] isn't mid-
      // interaction, so it can just invalidate and refetch normally.
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
