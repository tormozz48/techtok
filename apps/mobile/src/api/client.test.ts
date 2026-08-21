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

const ENTITLEMENT_INVALIDATION = { queryKey: ['entitlement'] };

beforeEach(() => {
  mockInvalidateQueries.mockReset();
  fetchMock.mockReset();
});

describe('entitlement snapshot refresh when the server reports a quota cap', () => {
  it('refreshes it when the feed reports an exhausted quota', async () => {
    const page: FeedResponse = {
      items: [],
      nextBefore: null,
      quotaExhausted: true,
      resetsAt: '2026-08-22T22:00:00.000Z',
    };
    fetchMock.mockResolvedValue(okResponse(page));

    await fetchFeedPage();

    expect(mockInvalidateQueries).toHaveBeenCalledWith(ENTITLEMENT_INVALIDATION);
  });

  it('leaves it alone on an ordinary feed page', async () => {
    const page: FeedResponse = { items: [], nextBefore: null };
    fetchMock.mockResolvedValue(okResponse(page));

    await fetchFeedPage();

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('refreshes it when a reader open is refused with 402', async () => {
    fetchMock.mockResolvedValue(errorResponse(402, 'quota_exceeded'));

    await expect(fetchPostContent('post-1', 'en')).rejects.toThrow(ApiError);

    expect(mockInvalidateQueries).toHaveBeenCalledWith(ENTITLEMENT_INVALIDATION);
  });

  it('still refreshes it on a successful reader open', async () => {
    const content: ContentResponse = { available: true, lang: 'en', blocks: [], figures: [] };
    fetchMock.mockResolvedValue(okResponse(content));

    await fetchPostContent('post-1', 'en');

    expect(mockInvalidateQueries).toHaveBeenCalledWith(ENTITLEMENT_INVALIDATION);
  });

  it('leaves it alone when a reader open fails for an unrelated reason', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'internal'));

    await expect(fetchPostContent('post-1', 'en')).rejects.toThrow(ApiError);

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
