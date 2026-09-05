import { beforeEach, describe, expect, it } from 'vitest';
import { useBookmarksOverlay } from './bookmarksOverlay';

describe('useBookmarksOverlay', () => {
  beforeEach(() => {
    useBookmarksOverlay.setState({ overlay: {} });
  });

  it('has no overlay entry by default', () => {
    expect(useBookmarksOverlay.getState().overlay.abc123).toBeUndefined();
  });

  it('sets and clears an optimistic value', () => {
    useBookmarksOverlay.getState().setOptimistic('abc123', true);
    expect(useBookmarksOverlay.getState().overlay.abc123).toBe(true);

    useBookmarksOverlay.getState().clear('abc123');
    expect(useBookmarksOverlay.getState().overlay.abc123).toBeUndefined();
  });

  it('reverting (setOptimistic back) undoes a failed toggle', () => {
    useBookmarksOverlay.getState().setOptimistic('abc123', true);
    useBookmarksOverlay.getState().setOptimistic('abc123', false);
    expect(useBookmarksOverlay.getState().overlay.abc123).toBe(false);
  });
});
