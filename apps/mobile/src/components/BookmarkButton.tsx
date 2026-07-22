import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createBookmark, deleteBookmark } from '@/api/client';
import { Colors } from '@/constants/theme';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';

export interface BookmarkButtonProps {
  postId: string;
  isBookmarked?: boolean;
}

export function BookmarkButton({ postId, isBookmarked }: BookmarkButtonProps) {
  const queryClient = useQueryClient();
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
      clearOptimistic(postId);
    } catch {
      setOptimistic(postId, bookmarked);
    }
  };

  return (
    <Pressable style={styles.button} onPress={toggle} hitSlop={8}>
      <Text style={styles.icon}>{bookmarked ? '🔖' : '📑'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No background/pill here (unlike its old floating-overlay days) — it now
  // sits in the bottom action bar's solid row (D25), matching its four
  // plain-icon neighbors (share, saved, history, settings).
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    color: Colors.overlay.text,
  },
});
