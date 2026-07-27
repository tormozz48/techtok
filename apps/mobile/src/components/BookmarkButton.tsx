import { useQueryClient } from '@tanstack/react-query';
import { IconButton } from 'react-native-paper';
import { createBookmark, deleteBookmark } from '@/api/client';
import { Colors } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';

export interface BookmarkButtonProps {
  postId: string;
  isBookmarked?: boolean;
}

export function BookmarkButton({ postId, isBookmarked }: BookmarkButtonProps) {
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
      } else {
        await deleteBookmark(postId);
      }
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      clearOptimistic(postId);
    } catch {
      setOptimistic(postId, bookmarked);
    }
  };

  return (
    <IconButton
      icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
      iconColor={Colors.overlay.text}
      size={20}
      onPress={toggle}
      accessibilityLabel={bookmarked ? strings.a11y.bookmarkRemove : strings.a11y.bookmarkAdd}
    />
  );
}
