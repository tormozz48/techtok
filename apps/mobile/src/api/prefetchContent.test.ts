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

let queryClient: QueryClient;

beforeEach(() => {
  fetchPostContentMock.mockReset();
  imagePrefetchMock.mockReset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  queryClient.clear();
  queryClient.unmount();
});

describe('prefetchPostContent', () => {
  it('populates the exact cache key the reader (post/[id].tsx) queries by', async () => {
    const response: ContentResponse = { available: true, lang: 'en', blocks: [], figures: [] };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'abc123', 'en');

    expect(queryClient.getQueryData(['content', 'abc123', 'en'])).toEqual(response);
  });

  it('fetches with the given postId and language, tagged as a prefetch', async () => {
    const response: ContentResponse = { available: true, lang: 'ru', blocks: [], figures: [] };
    fetchPostContentMock.mockResolvedValue(response);

    await prefetchPostContent(queryClient, 'xyz789', 'ru');

    expect(fetchPostContentMock).toHaveBeenCalledWith('xyz789', 'ru', 'prefetch');
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
