import { type FeedResponse, feedResponseSchema } from '@techtok/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface FetchFeedPageParams {
  before?: string;
  limit?: number;
}

export async function fetchFeedPage({
  before,
  limit = 20,
}: FetchFeedPageParams = {}): Promise<FeedResponse> {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your sst dev API URL.',
    );
  }

  const url = new URL('/v1/feed', API_URL);
  url.searchParams.set('limit', String(limit));
  if (before) url.searchParams.set('before', before);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`GET /v1/feed failed with status ${response.status}`);
  }

  return feedResponseSchema.parse(await response.json());
}
