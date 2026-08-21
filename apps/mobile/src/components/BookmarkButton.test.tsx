import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createBookmark, deleteBookmark } from '@/api/client';
import { prefetchPostContent } from '@/api/prefetchContent';
import { STRINGS } from '@/i18n/strings';
import { useBookmarksOverlay } from '@/state/bookmarksOverlay';
import { getIsWifi } from '@/state/network';
import {
  createTestQueryClient,
  renderWithQueryClient,
  resetSharedStores,
} from '@/testing/renderWithProviders';
import { BookmarkButton } from './BookmarkButton';

jest.mock('@/api/client', () => ({
  createBookmark: jest.fn(),
  deleteBookmark: jest.fn(),
  fetchMe: jest.fn(),
  putLanguage: jest.fn(),
}));
jest.mock('@/api/prefetchContent', () => ({
  prefetchPostContent: jest.fn(),
}));
jest.mock('@/state/network', () => ({
  getIsWifi: jest.fn(),
}));

const createBookmarkMock = createBookmark as jest.Mock;
const deleteBookmarkMock = deleteBookmark as jest.Mock;
const getIsWifiMock = getIsWifi as jest.Mock;
const prefetchPostContentMock = prefetchPostContent as jest.Mock;
const a11y = STRINGS.en.a11y;

let queryClient: QueryClient;

beforeEach(() => {
  resetSharedStores();
  createBookmarkMock.mockReset().mockResolvedValue(undefined);
  deleteBookmarkMock.mockReset().mockResolvedValue(undefined);
  getIsWifiMock.mockReset().mockReturnValue(false);
  prefetchPostContentMock.mockReset();
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
  queryClient.unmount();
});

describe('BookmarkButton', () => {
  it('shows the "add" label when not bookmarked', async () => {
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);
    expect(screen.getByLabelText(a11y.bookmarkAdd)).toBeTruthy();
  });

  it('shows the "remove" label when bookmarked', async () => {
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={true} />, queryClient);
    expect(screen.getByLabelText(a11y.bookmarkRemove)).toBeTruthy();
  });

  it('shows the bookmarked state immediately (optimistic), before the create request resolves', async () => {
    let resolveCreate: (() => void) | undefined;
    createBookmarkMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);

    const pressPromise = fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));
    await waitFor(() => expect(screen.getByLabelText(a11y.bookmarkRemove)).toBeTruthy());

    resolveCreate?.();
    await pressPromise;
  });

  it('shows the unbookmarked state immediately (optimistic), before the delete request resolves', async () => {
    let resolveDelete: (() => void) | undefined;
    deleteBookmarkMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={true} />, queryClient);

    const pressPromise = fireEvent.press(screen.getByLabelText(a11y.bookmarkRemove));
    await waitFor(() => expect(screen.getByLabelText(a11y.bookmarkAdd)).toBeTruthy());

    resolveDelete?.();
    await pressPromise;
  });

  it('creates the bookmark and clears the optimistic overlay once the request confirms', async () => {
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    expect(createBookmarkMock).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(useBookmarksOverlay.getState().overlay.p1).toBeUndefined());
  });

  it('deletes the bookmark and clears the optimistic overlay once the request confirms', async () => {
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={true} />, queryClient);

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkRemove));

    expect(deleteBookmarkMock).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(useBookmarksOverlay.getState().overlay.p1).toBeUndefined());
  });

  it('reverts the optimistic toggle when the create request fails', async () => {
    createBookmarkMock.mockRejectedValue(new Error('network down'));
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    await waitFor(() => expect(screen.getByLabelText(a11y.bookmarkAdd)).toBeTruthy());
  });

  it('calls onToggled with the confirmed state once the create request resolves', async () => {
    const onToggled = jest.fn();
    await renderWithQueryClient(
      <BookmarkButton postId="p1" isBookmarked={false} onToggled={onToggled} />,
      queryClient,
    );

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    expect(onToggled).toHaveBeenCalledWith(true);
  });

  it('calls onToggled with the confirmed state once the delete request resolves', async () => {
    const onToggled = jest.fn();
    await renderWithQueryClient(
      <BookmarkButton postId="p1" isBookmarked={true} onToggled={onToggled} />,
      queryClient,
    );

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkRemove));

    expect(onToggled).toHaveBeenCalledWith(false);
  });

  it('does not call onToggled when the request fails', async () => {
    createBookmarkMock.mockRejectedValue(new Error('network down'));
    const onToggled = jest.fn();
    await renderWithQueryClient(
      <BookmarkButton postId="p1" isBookmarked={false} onToggled={onToggled} />,
      queryClient,
    );

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    await waitFor(() => expect(screen.getByLabelText(a11y.bookmarkAdd)).toBeTruthy());
    expect(onToggled).not.toHaveBeenCalled();
  });

  it('prefetches post content over wifi when a new bookmark is created', async () => {
    getIsWifiMock.mockReturnValue(true);
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    await waitFor(() => expect(prefetchPostContent).toHaveBeenCalledWith(queryClient, 'p1', 'en'));
  });

  it('does not prefetch when off wifi', async () => {
    await renderWithQueryClient(<BookmarkButton postId="p1" isBookmarked={false} />, queryClient);

    await fireEvent.press(screen.getByLabelText(a11y.bookmarkAdd));

    await waitFor(() => expect(createBookmarkMock).toHaveBeenCalled());
    expect(prefetchPostContent).not.toHaveBeenCalled();
  });
});
