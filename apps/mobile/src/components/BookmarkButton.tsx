import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { FeedResponse } from '@techtok/shared';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from 'react-native-paper';
import { createBookmark, deleteBookmark } from '@/api/client';
import { prefetchPostContent } from '@/api/prefetchContent';
import { Colors } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';
import { useLanguageStore } from '@/state/languageStore';
import { getIsWifi } from '@/state/network';

export interface BookmarkButtonProps {
  postId: string;
  isBookmarked?: boolean;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
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
  queryClient.setQueryData<InfiniteData<FeedResponse>>(['feed'], (current) => {
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
        // Wifi-gated best-effort offline prep — a failure here shouldn't
        // affect the bookmark toggle itself, so no try/catch is needed:
        // prefetchQuery already swallows its own queryFn errors internally.
        if (getIsWifi()) {
          prefetchPostContent(queryClient, postId, useLanguageStore.getState().language);
        }
      } else {
        await deleteBookmark(postId);
      }
      // Patch the feed cache synchronously (see patchFeedBookmarkState) so
      // this card's `isBookmarked` prop is already correct once the overlay
      // clears below — no need to wait on it. Saved/[bookmarks] isn't mid-
      // interaction, so it can just invalidate and refetch normally.
      patchFeedBookmarkState(queryClient, postId, next);
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      clearOptimistic(postId);
    } catch {
      setOptimistic(postId, bookmarked);
    }
  };

  return (
    <IconButton
      icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
      iconColor={iconColor}
      size={20}
      style={style}
      onPress={toggle}
      accessibilityLabel={bookmarked ? strings.a11y.bookmarkRemove : strings.a11y.bookmarkAdd}
    />
  );
}
