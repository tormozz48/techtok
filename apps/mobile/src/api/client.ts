import {
  type BookmarksResponse,
  bookmarksResponseSchema,
  type ContentResponse,
  contentResponseSchema,
  DEVICE_ID_HEADER,
  DEVICE_LANGUAGE_HEADER,
  type FeedResponse,
  feedResponseSchema,
  type HistoryResponse,
  historyResponseSchema,
  type Language,
  type MeResponse,
  meResponseSchema,
  type Topic,
} from '@techtok/shared';
import { getOrCreateDeviceId } from '@/state/deviceId';
import { detectDeviceLanguage } from '@/state/deviceLanguage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function apiUrl(path: string): URL {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your sst dev API URL.',
    );
  }
  return new URL(path, API_URL);
}

async function apiFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      [DEVICE_ID_HEADER]: getOrCreateDeviceId(),
      [DEVICE_LANGUAGE_HEADER]: detectDeviceLanguage() ?? 'en',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${url.pathname} failed with status ${response.status}`,
    );
  }
  return response;
}

export interface FetchFeedPageParams {
  before?: string;
  limit?: number;
}

export async function fetchFeedPage({
  before,
  limit = 20,
}: FetchFeedPageParams = {}): Promise<FeedResponse> {
  const url = apiUrl('/v1/feed');
  url.searchParams.set('limit', String(limit));
  if (before) url.searchParams.set('before', before);

  const response = await apiFetch(url);
  return feedResponseSchema.parse(await response.json());
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await apiFetch(apiUrl('/v1/me'));
  return meResponseSchema.parse(await response.json());
}

export async function putTopics(topics: Topic[]): Promise<MeResponse> {
  const response = await apiFetch(apiUrl('/v1/me/topics'), {
    method: 'PUT',
    body: JSON.stringify({ topics }),
  });
  return meResponseSchema.parse(await response.json());
}

export async function putLanguage(language: Language): Promise<MeResponse> {
  const response = await apiFetch(apiUrl('/v1/me/language'), {
    method: 'PUT',
    body: JSON.stringify({ language }),
  });
  return meResponseSchema.parse(await response.json());
}

export async function postReads(postIds: string[]): Promise<void> {
  await apiFetch(apiUrl('/v1/reads'), {
    method: 'POST',
    body: JSON.stringify({ postIds }),
  });
}

export interface FetchHistoryPageParams {
  cursor?: string;
  limit?: number;
}

export async function fetchHistoryPage({
  cursor,
  limit = 50,
}: FetchHistoryPageParams = {}): Promise<HistoryResponse> {
  const url = apiUrl('/v1/history');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await apiFetch(url);
  return historyResponseSchema.parse(await response.json());
}

export interface FetchBookmarksPageParams {
  cursor?: string;
  limit?: number;
}

export async function fetchBookmarksPage({
  cursor,
  limit = 50,
}: FetchBookmarksPageParams = {}): Promise<BookmarksResponse> {
  const url = apiUrl('/v1/bookmarks');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await apiFetch(url);
  return bookmarksResponseSchema.parse(await response.json());
}

export async function createBookmark(postId: string): Promise<void> {
  await apiFetch(apiUrl('/v1/bookmarks'), {
    method: 'POST',
    body: JSON.stringify({ postId }),
  });
}

export async function deleteBookmark(postId: string): Promise<void> {
  await apiFetch(apiUrl(`/v1/bookmarks/${encodeURIComponent(postId)}`), {
    method: 'DELETE',
  });
}

export async function getPostContent(postId: string, lang: Language): Promise<ContentResponse> {
  const url = apiUrl(`/v1/posts/${encodeURIComponent(postId)}/content`);
  url.searchParams.set('lang', lang);

  const response = await apiFetch(url);
  return contentResponseSchema.parse(await response.json());
}
