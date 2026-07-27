import { randomUUID } from 'node:crypto';
import {
  bookmarksResponseSchema,
  DEVICE_ID_HEADER,
  DEVICE_LANGUAGE_HEADER,
  feedResponseSchema,
  historyResponseSchema,
  meResponseSchema,
  sourcesResponseSchema,
  topicsResponseSchema,
} from '@techtok/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { discoverDevResources, getApiEndpoint } from './awsDiscovery';

/** A fresh device identity, isolated from every other test in this file —
 * mutation tests need their own user row so they can't see stale state left
 * behind by another test (or be seen by one), regardless of run order. */
function freshHeaders(): Record<string, string> {
  return { [DEVICE_ID_HEADER]: randomUUID(), [DEVICE_LANGUAGE_HEADER]: 'en' };
}

/**
 * Calls the real deployed `dev` API over HTTP — exactly the requests the
 * mobile client makes on a fresh device — and parses every response through
 * the same `packages/shared` zod schemas the app itself uses. A parse
 * failure here means an already-installed, sideloaded APK (no auto-update,
 * D18) would fail to render (DESIGN §2 D34). Never run against `production`.
 */
describe('API contract E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverDevResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
    headers = freshHeaders();
  }, 60_000);

  it('GET /v1/topics returns a body matching topicsResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/topics?lang=en`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => topicsResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/sources returns a body matching sourcesResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/sources`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => sourcesResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/me returns a body matching meResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/me`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => meResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/feed returns a body matching feedResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/feed`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => feedResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/history returns a body matching historyResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/history`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => historyResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/bookmarks returns a body matching bookmarksResponseSchema', async () => {
    const res = await fetch(`${apiEndpoint}/v1/bookmarks`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => bookmarksResponseSchema.parse(body)).not.toThrow();
  });
});

/**
 * Round-trips every mutation endpoint against the real `dev` API — the GET
 * suite above only ever reads, so a handler that's wired up wrong (e.g. an
 * env var/table link a route's infra config never declared) can 500 in
 * production while every GET-only contract test keeps passing, exactly what
 * happened to `POST /v1/bookmarks` (missing `usersTable` link). Each test
 * uses its own fresh device so they can run in any order without seeing each
 * other's state.
 */
describe('API mutation E2E', () => {
  let apiEndpoint: string;

  beforeAll(async () => {
    const resources = await discoverDevResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
  }, 60_000);

  async function fetchFirstPostId(headers: Record<string, string>): Promise<string> {
    const res = await fetch(`${apiEndpoint}/v1/feed`, { headers });
    expect(res.status).toBe(200);
    const feed = feedResponseSchema.parse(await res.json());
    const postId = feed.items[0]?.id;
    if (!postId) throw new Error('GET /v1/feed returned no items to exercise a mutation against');
    return postId;
  }

  it('POST /v1/reads marks a post read, and it shows up in GET /v1/history', async () => {
    const headers = freshHeaders();
    const postId = await fetchFirstPostId(headers);

    const readsRes = await fetch(`${apiEndpoint}/v1/reads`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postIds: [postId] }),
    });
    expect(readsRes.status).toBe(204);

    const historyRes = await fetch(`${apiEndpoint}/v1/history`, { headers });
    expect(historyRes.status).toBe(200);
    const history = historyResponseSchema.parse(await historyRes.json());
    expect(history.items.some((item) => item.postId === postId)).toBe(true);
  });

  it('PUT /v1/me/topics persists the given topics into GET /v1/me', async () => {
    const headers = freshHeaders();
    const topics = ['ai', 'security'];

    const putRes = await fetch(`${apiEndpoint}/v1/me/topics`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ topics }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.topics.slice().sort()).toEqual(topics.slice().sort());

    const meRes = await fetch(`${apiEndpoint}/v1/me`, { headers });
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.topics.slice().sort()).toEqual(topics.slice().sort());
  });

  it('PUT /v1/me/language persists the given language into GET /v1/me', async () => {
    const headers = freshHeaders();

    const putRes = await fetch(`${apiEndpoint}/v1/me/language`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'ru' }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.language).toBe('ru');

    const meRes = await fetch(`${apiEndpoint}/v1/me`, { headers });
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.language).toBe('ru');
  });

  it('PUT /v1/me/muted-sources persists the given source ids into GET /v1/me', async () => {
    const headers = freshHeaders();
    const sourceIds = ['e2e-mutation-test-source'];

    const putRes = await fetch(`${apiEndpoint}/v1/me/muted-sources`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.mutedSources).toEqual(sourceIds);

    const meRes = await fetch(`${apiEndpoint}/v1/me`, { headers });
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.mutedSources).toEqual(sourceIds);
  });

  it('POST /v1/bookmarks creates a bookmark visible in GET /v1/bookmarks, DELETE removes it', async () => {
    const headers = freshHeaders();
    const postId = await fetchFirstPostId(headers);

    const createRes = await fetch(`${apiEndpoint}/v1/bookmarks`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    expect(createRes.status).toBe(204);

    const afterCreateRes = await fetch(`${apiEndpoint}/v1/bookmarks`, { headers });
    const afterCreate = bookmarksResponseSchema.parse(await afterCreateRes.json());
    expect(afterCreate.items.some((item) => item.postId === postId)).toBe(true);

    const deleteRes = await fetch(`${apiEndpoint}/v1/bookmarks/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers,
    });
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await fetch(`${apiEndpoint}/v1/bookmarks`, { headers });
    const afterDelete = bookmarksResponseSchema.parse(await afterDeleteRes.json());
    expect(afterDelete.items.some((item) => item.postId === postId)).toBe(false);
  });
});
