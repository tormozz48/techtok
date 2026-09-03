import {
  type BookmarksResponse,
  bookmarksResponseSchema,
  type ClientRecord,
  type ContentResponse,
  contentResponseSchema,
  DEVICE_LANGUAGE_HEADER,
  DEVICE_TIMEZONE_HEADER,
  type EntitlementResponse,
  entitlementResponseSchema,
  type FeedResponse,
  feedResponseSchema,
  type HistoryResponse,
  historyResponseSchema,
  type Language,
  type MeResponse,
  meResponseSchema,
  REQUEST_ID_HEADER,
  type SourcesResponse,
  sourcesResponseSchema,
  type Topic,
} from '@techtok/shared';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '@/state/authStore';
import { detectDeviceLanguage, detectDeviceTimezone } from '@/state/deviceLanguage';
import { logError, serializeError } from '@/state/logStore';
import { queryClient } from '@/state/queryClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const DEFAULT_PAGE_LIMIT = 50;

export interface FetchFeedPageParams {
  before?: string;
  limit?: number;
}

export interface FetchHistoryPageParams {
  cursor?: string;
  limit?: number;
  q?: string;
}

export interface FetchBookmarksPageParams {
  cursor?: string;
  limit?: number;
  q?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchFeedPage({
  before,
  limit = 20,
}: FetchFeedPageParams = {}): Promise<FeedResponse> {
  const url = apiUrl('/v1/feed');
  url.searchParams.set('limit', String(limit));
  if (before) url.searchParams.set('before', before);

  const response = await apiFetch(url);
  const parsed = feedResponseSchema.parse(await response.json());
  if (parsed.quotaExhausted) {
    queryClient.invalidateQueries({ queryKey: ['entitlement'] });
  }
  return parsed;
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

export async function putMutedSources(sourceIds: string[]): Promise<MeResponse> {
  const response = await apiFetch(apiUrl('/v1/me/muted-sources'), {
    method: 'PUT',
    body: JSON.stringify({ sourceIds }),
  });
  return meResponseSchema.parse(await response.json());
}

export async function fetchSources(): Promise<SourcesResponse> {
  const response = await apiFetch(apiUrl('/v1/sources'));
  return sourcesResponseSchema.parse(await response.json());
}

export async function postReads(postIds: string[]): Promise<void> {
  await apiFetch(apiUrl('/v1/reads'), {
    method: 'POST',
    body: JSON.stringify({ postIds }),
  });
  queryClient.invalidateQueries({ queryKey: ['entitlement'] });
}

export async function postEvents(records: ClientRecord[]): Promise<void> {
  await apiFetch(apiUrl('/v1/events'), {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function fetchHistoryPage({
  cursor,
  limit = DEFAULT_PAGE_LIMIT,
  q,
}: FetchHistoryPageParams = {}): Promise<HistoryResponse> {
  const url = apiUrl('/v1/history');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  if (q) url.searchParams.set('q', q);

  const response = await apiFetch(url);
  return historyResponseSchema.parse(await response.json());
}

export async function fetchBookmarksPage({
  cursor,
  limit = DEFAULT_PAGE_LIMIT,
  q,
}: FetchBookmarksPageParams = {}): Promise<BookmarksResponse> {
  const url = apiUrl('/v1/bookmarks');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  if (q) url.searchParams.set('q', q);

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

export async function fetchPostContent(postId: string, lang: Language): Promise<ContentResponse> {
  const url = apiUrl(`/v1/posts/${encodeURIComponent(postId)}/content`);
  url.searchParams.set('lang', lang);

  try {
    const response = await apiFetch(url);
    const parsed = contentResponseSchema.parse(await response.json());
    queryClient.invalidateQueries({ queryKey: ['entitlement'] });
    return parsed;
  } catch (err) {
    if (isReaderOpensCapReached(err)) {
      queryClient.invalidateQueries({ queryKey: ['entitlement'] });
    }
    throw err;
  }
}

export async function deleteAccount(): Promise<void> {
  await apiFetch(apiUrl('/v1/me'), { method: 'DELETE' });
}

export async function fetchEntitlement(): Promise<EntitlementResponse> {
  const response = await apiFetch(apiUrl('/v1/me/entitlement'));
  return entitlementResponseSchema.parse(await response.json());
}

function isReaderOpensCapReached(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}

function apiUrl(path: string): URL {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your sst dev API URL.',
    );
  }
  return new URL(path, API_URL);
}

function buildHeaders(init: RequestInit, requestId: string): HeadersInit {
  const idToken = useAuthStore.getState().user?.idToken;
  return {
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    [DEVICE_LANGUAGE_HEADER]: detectDeviceLanguage() ?? 'en',
    [DEVICE_TIMEZONE_HEADER]: detectDeviceTimezone() ?? 'UTC',
    [REQUEST_ID_HEADER]: requestId,
    ...(init.body ? { 'content-type': 'application/json' } : {}),
    ...init.headers,
  };
}

async function apiFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const requestId = Crypto.randomUUID();
  const method = init.method ?? 'GET';
  const wasAuthenticated = useAuthStore.getState().user !== null;
  let response: Response;
  try {
    response = await fetch(url.toString(), { ...init, headers: buildHeaders(init, requestId) });
  } catch (err) {
    logError(
      'api network request failed',
      { requestId, method, path: url.pathname, ...serializeError(err) },
      err,
    );
    throw err;
  }

  if (response.status === 401 && wasAuthenticated) {
    const refreshedIdToken = await useAuthStore.getState().refreshToken();
    if (refreshedIdToken) {
      response = await fetch(url.toString(), { ...init, headers: buildHeaders(init, requestId) });
    }
  }

  if (!response.ok) {
    let code: string | undefined;
    let message = `${method} ${url.pathname} failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code;
      message = body.error?.message ?? message;
    } catch {}
    logError('api request failed', {
      requestId,
      method,
      path: url.pathname,
      status: response.status,
      code,
    });
    throw new ApiError(response.status, code, message);
  }
  return response;
}
