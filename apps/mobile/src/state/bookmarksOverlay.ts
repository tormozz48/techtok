import { create } from 'zustand';
import { logEvent } from './eventsQueue';

interface BookmarksOverlayState {
  overlay: Record<string, boolean>;
  setOptimistic: (postId: string, value: boolean) => void;
  clear: (postId: string) => void;
}

export const useBookmarksOverlay = create<BookmarksOverlayState>((set) => ({
  overlay: {},
  setOptimistic: (postId, value) => {
    set((state) => ({ overlay: { ...state.overlay, [postId]: value } }));
    logEvent('bookmark_optimistic_set', { postId, value });
  },
  clear: (postId) => {
    set((state) => {
      const { [postId]: _removed, ...rest } = state.overlay;
      return { overlay: rest };
    });
    logEvent('bookmark_optimistic_cleared', { postId });
  },
}));
