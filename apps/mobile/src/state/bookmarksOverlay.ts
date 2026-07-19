import { create } from 'zustand';

interface BookmarksOverlayState {
  overlay: Record<string, boolean>;
  setOptimistic: (postId: string, value: boolean) => void;
  clear: (postId: string) => void;
}

/**
 * Transient (non-persisted) local override for a card's bookmarked state, so
 * toggling feels instant instead of waiting on a query invalidation/refetch.
 * Not wired into TanStack Query's cache — deliberately decoupled so a failed
 * mutation can revert without touching the 'feed'/'bookmarks' query data.
 */
export const useBookmarksOverlay = create<BookmarksOverlayState>((set) => ({
  overlay: {},
  setOptimistic: (postId, value) =>
    set((state) => ({ overlay: { ...state.overlay, [postId]: value } })),
  clear: (postId) =>
    set((state) => {
      const { [postId]: _removed, ...rest } = state.overlay;
      return { overlay: rest };
    }),
}));
