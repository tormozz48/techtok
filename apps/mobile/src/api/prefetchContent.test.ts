import { QueryClient } from '@tanstack/react-query';
import type { ContentResponse } from '@techtok/shared';
import { Image } from 'expo-image';
import { fetchPostContent } from './client';
import { prefetchPostContent } from './prefetchContent';

jest.mock('./client', () => ({
  fetchPostContent: jest.fn(),
}));

jest.mock('expo-image', () => ({
  Image: { prefetch: jest.fn() },
}));

const fetchPostContentMock = fetchPostContent as jest.Mock;
const imagePrefetchMock = Image.prefetch as jest.Mock;

// retry: false is load-bearing, not just tidiness — without it, a rejected
// mock (or a real bug leaving the mock unapplied) would retry with backoff
// and make the test hang instead of failing fast. unmount() in afterEach
// stops QueryClient's internal focus/online listeners, which otherwise keep
// the process alive after the tests themselves finish.
let queryClient: QueryClient;

beforeEach(() => {
  fetchPostContentMock.mockReset();
  imagePrefetchMock.mockReset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  // clear() cancels each cached query's pending garbage-collection timer
  // (default gcTime is 5 minutes) — unmount() alone stops the client's own
  // focus/online listeners but leaves those per-query timers scheduled,
  // which is what was actually keeping the test process alive.
  queryClient.clear();
  queryClient.unmount();
});

describe('prefetchPostContent', () => {
  it('populates the exact cache key the reader (post/[id].tsx) queries by', async () => {
    const response: ContentResponse = { available: true, lang: 'en', blocks: [], figures: [] };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'abc123', 'en');

    // Must match post/[id].tsx's `queryKey: ['content', id, viewLang]` exactly
    // — any drift here silently makes the whole prefetch feature a no-op,
    // since the reader would just miss the cache and refetch anyway.
    expect(queryClient.getQueryData(['content', 'abc123', 'en'])).toEqual(response);
  });

  it('fetches with the given postId and language', async () => {
    const response: ContentResponse = { available: true, lang: 'ru', blocks: [], figures: [] };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'xyz789', 'ru');

    expect(fetchPostContentMock).toHaveBeenCalledWith('xyz789', 'ru');
  });

  it('resolves without throwing when the fetch itself fails', async () => {
    fetchPostContentMock.mockRejectedValue(new Error('network down'));

    await expect(prefetchPostContent(queryClient, 'abc123', 'en')).resolves.toBeUndefined();
    expect(queryClient.getQueryData(['content', 'abc123', 'en'])).toBeUndefined();
  });

  it('prefetches every figure image alongside the article text (D61)', async () => {
    const response: ContentResponse = {
      available: true,
      lang: 'en',
      blocks: [],
      figures: [
        { url: 'https://example.com/a.jpg' },
        { url: 'https://example.com/b.jpg', caption: 'b' },
      ],
    };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'abc123', 'en');

    expect(imagePrefetchMock).toHaveBeenCalledWith('https://example.com/a.jpg');
    expect(imagePrefetchMock).toHaveBeenCalledWith('https://example.com/b.jpg');
    expect(imagePrefetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not prefetch any figures when content is unavailable', async () => {
    const response: ContentResponse = { available: false, reason: 'kill-switch' };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'abc123', 'en');

    expect(imagePrefetchMock).not.toHaveBeenCalled();
  });
});
