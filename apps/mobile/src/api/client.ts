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
import { logError } from '@/state/logStore';
import { queryClient } from '@/state/queryClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** Default page size shared by fetchHistoryPage and fetchBookmarksPage. */
const DEFAULT_PAGE_LIMIT = 50;

/** Carries the response status/error code through a failed request so
 * callers can distinguish "quota exceeded" (402, D69) from any other
 * failure — e.g. the reader routes to `/paywall` on 402 instead of showing
 * its generic error state. */
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

/**
 * Google ID tokens expire in ~1h (D68), so a 401 triggers exactly one silent
 * re-sign-in + retry before giving up — the same shape as any other
 * transient-auth-failure retry, not a sign-out loop. `GET /v1/topics` and
 * `GET /v1/sources` never 401 (no authorizer attached, DESIGN §5), so this
 * only ever fires for the authenticated routes.
 *
 * Every call carries a client-generated `REQUEST_ID_HEADER` (kept across the
 * 401 retry, since it's still logically the same request) so a failure
 * logged here and the matching backend log line (`packages/functions/src/api/lib/http.ts`)
 * can be correlated in CloudWatch Logs Insights.
 */
async function apiFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const requestId = Crypto.randomUUID();
  const method = init.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(url.toString(), { ...init, headers: buildHeaders(init, requestId) });
  } catch (err) {
    logError('api network request failed', {
      requestId,
      method,
      path: url.pathname,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  if (response.status === 401) {
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
    } catch {
      // Non-JSON error body (e.g. an API Gateway-level rejection) — keep the generic message.
    }
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

export async function putMutedSources(sourceIds: string[]): Promise<MeResponse> {
  const response = await apiFetch(apiUrl('/v1/me/muted-sources'), {
    method: 'PUT',
    body: JSON.stringify({ sourceIds }),
  });
  return meResponseSchema.parse(await response.json());
}

/** Public source catalog (no device id needed) — lets the app render a mute
 * picker without hardcoding the source list. */
export async function fetchSources(): Promise<SourcesResponse> {
  const response = await apiFetch(apiUrl('/v1/sources'));
  return sourcesResponseSchema.parse(await response.json());
}

export async function postReads(postIds: string[]): Promise<void> {
  await apiFetch(apiUrl('/v1/reads'), {
    method: 'POST',
    body: JSON.stringify({ postIds }),
  });
  // A newly-read post burns the D69 cardReads quota server-side — invalidate
  // so the feed's QuotaBadge/paywall reflect it without waiting on staleTime
  // + an unrelated focus/mount trigger to happen to fire.
  queryClient.invalidateQueries({ queryKey: ['entitlement'] });
}

/** Client-batched logs + product analytics (D76) — fire-and-forget from the
 * caller's perspective; `eventsQueue.ts` owns retry-on-failure. */
export async function postEvents(records: ClientRecord[]): Promise<void> {
  await apiFetch(apiUrl('/v1/events'), {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export interface FetchHistoryPageParams {
  cursor?: string;
  limit?: number;
  /** When set, searches cardTitle/sourceName instead of paginating — the
   * response's nextCursor always comes back null. */
  q?: string;
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

export interface FetchBookmarksPageParams {
  cursor?: string;
  limit?: number;
  /** Same search contract as fetchHistoryPage's q. */
  q?: string;
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

/** Reads a compact article (D23; eager generation as of D36) — a plain cache
 * read, no job ids or polling. `intent: 'prefetch'` (D61's read-ahead /
 * bookmark wifi-prefetch) tells the server this is speculative background
 * cache-warming, not a genuine reader open — it skips the D69 reader-opens
 * quota gate/increment there, and skips invalidating `['entitlement']` here
 * since nothing server-side actually changed. */
export async function fetchPostContent(
  postId: string,
  lang: Language,
  intent: 'read' | 'prefetch' = 'read',
): Promise<ContentResponse> {
  const url = apiUrl(`/v1/posts/${encodeURIComponent(postId)}/content`);
  url.searchParams.set('lang', lang);
  if (intent === 'prefetch') url.searchParams.set('intent', intent);

  const response = await apiFetch(url);
  const parsed = contentResponseSchema.parse(await response.json());
  if (intent === 'read') {
    queryClient.invalidateQueries({ queryKey: ['entitlement'] });
  }
  return parsed;
}

/** Deletes the signed-in user's account and all their data (D68) — required
 * by Google Play policy for any app with accounts. Irreversible. */
export async function deleteAccount(): Promise<void> {
  await apiFetch(apiUrl('/v1/me'), { method: 'DELETE' });
}

/** Current plan + today's quota usage/limits (D69/D70) — the single call
 * every paywall surface (the feed/reader exhaustion states, the paywall
 * screen itself, the settings quota row) reads from. */
export async function fetchEntitlement(): Promise<EntitlementResponse> {
  const response = await apiFetch(apiUrl('/v1/me/entitlement'));
  return entitlementResponseSchema.parse(await response.json());
}
