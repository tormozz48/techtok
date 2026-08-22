import { create } from 'zustand';

interface BookmarksOverlayState {
  overlay: Record<string, boolean>;
  setOptimistic: (postId: string, value: boolean) => void;
  clear: (postId: string) => void;
}

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
