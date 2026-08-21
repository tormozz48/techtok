import type { ContentResponse, FeedResponse } from '@techtok/shared';

const mockInvalidateQueries = jest.fn();

jest.mock('@/state/queryClient', () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-request-id' }));

jest.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ user: null, refreshToken: jest.fn() }) },
}));

jest.mock('@/state/deviceLanguage', () => ({
  detectDeviceLanguage: () => 'en',
  detectDeviceTimezone: () => 'Europe/Warsaw',
}));

jest.mock('@/state/logStore', () => ({ logError: jest.fn() }));

// API_URL is captured at module scope, so the env var has to be set before
// `./client` is first required — hence require() here rather than an import.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
const { ApiError, fetchFeedPage, fetchPostContent } = require('./client');

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function errorResponse(status: number, code: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: { code, message: 'nope' } }),
  } as unknown as Response;
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  mockInvalidateQueries.mockReset();
  fetchMock.mockReset();
});

/**
 * The ['entitlement'] snapshot behind the QuotaBadge and D81's feed gate used
 * to be refreshed only by requests that *succeeded*, which left the counters
 * frozen below their own limit exactly when they had just reached it: the
 * reader's 402 threw before the invalidation, and an exhausted feed stops
 * producing the read flushes that were the only other refresh trigger.
 */
describe('quota-counter invalidation', () => {
  it('refreshes the entitlement snapshot when the feed reports an exhausted quota', async () => {
    const page: FeedResponse = {
      items: [],
      nextBefore: null,
      quotaExhausted: true,
      resetsAt: '2026-08-22T22:00:00.000Z',
    };
    fetchMock.mockResolvedValue(okResponse(page));

    await fetchFeedPage();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['entitlement'] });
  });

  it('leaves the entitlement snapshot alone on an ordinary feed page', async () => {
    const page: FeedResponse = { items: [], nextBefore: null };
    fetchMock.mockResolvedValue(okResponse(page));

    await fetchFeedPage();

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('refreshes the entitlement snapshot when a reader open is refused with 402', async () => {
    fetchMock.mockResolvedValue(errorResponse(402, 'quota_exceeded'));

    await expect(fetchPostContent('post-1', 'en')).rejects.toThrow(ApiError);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['entitlement'] });
  });

  it('still refreshes it on a successful reader open', async () => {
    const content: ContentResponse = { available: true, lang: 'en', blocks: [], figures: [] };
    fetchMock.mockResolvedValue(okResponse(content));

    await fetchPostContent('post-1', 'en');

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['entitlement'] });
  });

  it('ignores a prefetch, which never consumes or reports quota', async () => {
    fetchMock.mockResolvedValue(errorResponse(402, 'quota_exceeded'));

    await expect(fetchPostContent('post-1', 'en', 'prefetch')).rejects.toThrow(ApiError);

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('does not refresh it on an unrelated failure', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'internal'));

    await expect(fetchPostContent('post-1', 'en')).rejects.toThrow(ApiError);

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
