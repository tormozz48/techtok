import {
  bookmarksResponseSchema,
  contentResponseSchema,
  DEVICE_LANGUAGE_HEADER,
  entitlementResponseSchema,
  errorResponseSchema,
  feedResponseSchema,
  historyResponseSchema,
  meResponseSchema,
  sourcesResponseSchema,
  topicsResponseSchema,
} from '@techtok/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { discoverStageResources, getApiEndpoint } from './awsDiscovery';
import { fetchTestIdToken, readTestCredentials } from './googleTestAuth';

const testCredentials = readTestCredentials();

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 5): Promise<Response> {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, init);
    if (res.status < 500 || attempt === attempts - 1) return res;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}

async function fetchFirstPostId(
  apiEndpoint: string,
  headers: Record<string, string>,
): Promise<string> {
  const res = await fetchWithRetry(`${apiEndpoint}/v1/feed`, { headers });
  expect(res.status).toBe(200);
  const feed = feedResponseSchema.parse(await res.json());
  const postId = feed.items[0]?.id;
  if (!postId) throw new Error('GET /v1/feed returned no items to exercise a mutation against');
  return postId;
}

describe.skipIf(!testCredentials)('API contract E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverStageResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
    // biome-ignore lint/style/noNonNullAssertion: describe.skipIf above guarantees this block only runs when testCredentials is set.
    const idToken = await fetchTestIdToken(testCredentials!);
    headers = { Authorization: `Bearer ${idToken}`, [DEVICE_LANGUAGE_HEADER]: 'en' };
  }, 60_000);

  it('GET /v1/topics returns a body matching topicsResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/topics?lang=en`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => topicsResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/sources returns a body matching sourcesResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/sources`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => sourcesResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/me returns a body matching meResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => meResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/feed returns a body matching feedResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/feed`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => feedResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/history returns a body matching historyResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/history`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => historyResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/bookmarks returns a body matching bookmarksResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/bookmarks`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => bookmarksResponseSchema.parse(body)).not.toThrow();
  });
});

describe.skipIf(!testCredentials)('API mutation E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverStageResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
    // biome-ignore lint/style/noNonNullAssertion: describe.skipIf above guarantees this block only runs when testCredentials is set.
    const idToken = await fetchTestIdToken(testCredentials!);
    headers = { Authorization: `Bearer ${idToken}`, [DEVICE_LANGUAGE_HEADER]: 'en' };
  }, 60_000);

  it('POST /v1/reads marks a post read, and it shows up in GET /v1/history', async () => {
    const postId = await fetchFirstPostId(apiEndpoint, headers);

    const readsRes = await fetchWithRetry(`${apiEndpoint}/v1/reads`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postIds: [postId] }),
    });
    expect(readsRes.status).toBe(204);

    const historyRes = await fetchWithRetry(`${apiEndpoint}/v1/history`, { headers });
    expect(historyRes.status).toBe(200);
    const history = historyResponseSchema.parse(await historyRes.json());
    expect(history.items.some((item) => item.postId === postId)).toBe(true);
  });

  it('PUT /v1/me/topics persists the given topics into GET /v1/me', async () => {
    const topics = ['ai', 'security'];

    const putRes = await fetchWithRetry(`${apiEndpoint}/v1/me/topics`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ topics }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.topics.slice().sort()).toEqual(topics.slice().sort());

    const meRes = await fetchWithRetry(`${apiEndpoint}/v1/me`, { headers });
    expect(meRes.status).toBe(200);
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.topics.slice().sort()).toEqual(topics.slice().sort());
  });

  it('PUT /v1/me/language persists the given language into GET /v1/me', async () => {
    const putRes = await fetchWithRetry(`${apiEndpoint}/v1/me/language`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'ru' }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.language).toBe('ru');

    const meRes = await fetchWithRetry(`${apiEndpoint}/v1/me`, { headers });
    expect(meRes.status).toBe(200);
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.language).toBe('ru');
  });

  it('PUT /v1/me/muted-sources persists the given source ids into GET /v1/me', async () => {
    const sourceIds = ['e2e-mutation-test-source'];

    const putRes = await fetchWithRetry(`${apiEndpoint}/v1/me/muted-sources`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
    });
    expect(putRes.status).toBe(200);
    const putBody = meResponseSchema.parse(await putRes.json());
    expect(putBody.mutedSources).toEqual(sourceIds);

    const meRes = await fetchWithRetry(`${apiEndpoint}/v1/me`, { headers });
    expect(meRes.status).toBe(200);
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.mutedSources).toEqual(sourceIds);
  });

  it('POST /v1/bookmarks creates a bookmark visible in GET /v1/bookmarks, DELETE removes it', async () => {
    const postId = await fetchFirstPostId(apiEndpoint, headers);

    const createRes = await fetchWithRetry(`${apiEndpoint}/v1/bookmarks`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    expect(createRes.status).toBe(204);

    const afterCreateRes = await fetchWithRetry(`${apiEndpoint}/v1/bookmarks`, { headers });
    const afterCreate = bookmarksResponseSchema.parse(await afterCreateRes.json());
    expect(afterCreate.items.some((item) => item.postId === postId)).toBe(true);

    const deleteRes = await fetchWithRetry(
      `${apiEndpoint}/v1/bookmarks/${encodeURIComponent(postId)}`,
      {
        method: 'DELETE',
        headers,
      },
    );
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await fetchWithRetry(`${apiEndpoint}/v1/bookmarks`, { headers });
    const afterDelete = bookmarksResponseSchema.parse(await afterDeleteRes.json());
    expect(afterDelete.items.some((item) => item.postId === postId)).toBe(false);
  });
});

describe.skipIf(!testCredentials)('API auth failures E2E', () => {
  let apiEndpoint: string;

  beforeAll(async () => {
    const resources = await discoverStageResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
  }, 60_000);

  it('GET /v1/me with no Authorization header returns 401', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me`);
    expect(res.status).toBe(401);
  });

  it('GET /v1/me with a malformed bearer token returns 401', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me`, {
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /v1/feed with no Authorization header returns 401', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/feed`);
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!testCredentials)('API validation & edge-case E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverStageResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
    // biome-ignore lint/style/noNonNullAssertion: describe.skipIf above guarantees this block only runs when testCredentials is set.
    const idToken = await fetchTestIdToken(testCredentials!);
    headers = { Authorization: `Bearer ${idToken}`, [DEVICE_LANGUAGE_HEADER]: 'en' };
  }, 60_000);

  it('GET /v1/topics?lang=xx (invalid language) returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/topics?lang=xx`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(() => errorResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/feed?limit=0 (below the minimum) returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/feed?limit=0`, { headers });
    expect(res.status).toBe(400);
  });

  it('GET /v1/feed?limit=51 (above the maximum) returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/feed?limit=51`, { headers });
    expect(res.status).toBe(400);
  });

  it('GET /v1/feed?limit=1 returns at most one item', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/feed?limit=1`, { headers });
    expect(res.status).toBe(200);
    const body = feedResponseSchema.parse(await res.json());
    expect(body.items.length).toBeLessThanOrEqual(1);
  });

  it('GET /v1/history?limit=101 (above the maximum) returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/history?limit=101`, { headers });
    expect(res.status).toBe(400);
  });

  it('GET /v1/history?q=... searches instead of paginating (nextCursor always null)', async () => {
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/history?q=${encodeURIComponent('e2e-search-probe')}`,
      { headers },
    );
    expect(res.status).toBe(200);
    const body = historyResponseSchema.parse(await res.json());
    expect(body.nextCursor).toBeNull();
  });

  it('GET /v1/bookmarks?q=... searches instead of paginating (nextCursor always null)', async () => {
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/bookmarks?q=${encodeURIComponent('e2e-search-probe')}`,
      { headers },
    );
    expect(res.status).toBe(200);
    const body = bookmarksResponseSchema.parse(await res.json());
    expect(body.nextCursor).toBeNull();
  });

  it('PUT /v1/me/topics with an unknown topic id returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me/topics`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ topics: ['not-a-real-topic'] }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /v1/me/language with an unsupported language returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me/language`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'xx' }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /v1/me/muted-sources with more than 100 ids returns 400', async () => {
    const sourceIds = Array.from({ length: 101 }, (_, i) => `e2e-source-${i}`);
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me/muted-sources`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/reads with an empty postIds array returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/reads`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/reads with more than 100 postIds returns 400', async () => {
    const postIds = Array.from({ length: 101 }, (_, i) => `e2e-post-${i}`);
    const res = await fetchWithRetry(`${apiEndpoint}/v1/reads`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postIds }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/reads for a post id that does not exist is a content-level no-op (204)', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/reads`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postIds: ['e2e-nonexistent-post-id'] }),
    });
    expect(res.status).toBe(204);
  });

  it('POST /v1/bookmarks for a post id that does not exist returns 404', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/bookmarks`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 'e2e-nonexistent-post-id' }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /v1/bookmarks/{postId} for a post that was never bookmarked is idempotent (204)', async () => {
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/bookmarks/${encodeURIComponent('e2e-never-bookmarked-post-id')}`,
      { method: 'DELETE', headers },
    );
    expect(res.status).toBe(204);
  });

  it('POST /v1/events accepts a batch of log and analytics records', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/events`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        records: [
          {
            kind: 'log',
            level: 'info',
            message: 'e2e validation probe',
            occurredAt: new Date().toISOString(),
          },
          {
            kind: 'event',
            name: 'e2e_validation_probe',
            occurredAt: new Date().toISOString(),
          },
        ],
      }),
    });
    expect(res.status).toBe(204);
  });

  it('POST /v1/events with an invalid record returns 400', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/events`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ records: [{ kind: 'log', level: 'not-a-real-level' }] }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /v1/me/entitlement returns a body matching entitlementResponseSchema', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me/entitlement`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => entitlementResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/posts/{postId}/content for an existing post matches contentResponseSchema', async () => {
    const postId = await fetchFirstPostId(apiEndpoint, headers);
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/posts/${encodeURIComponent(postId)}/content`,
      {
        headers,
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => contentResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/posts/{postId}/content?intent=prefetch does not error', async () => {
    const postId = await fetchFirstPostId(apiEndpoint, headers);
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/posts/${encodeURIComponent(postId)}/content?intent=prefetch`,
      { headers },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => contentResponseSchema.parse(body)).not.toThrow();
  });

  it('GET /v1/posts/{postId}/content?lang=xx (invalid language) returns 400', async () => {
    const postId = await fetchFirstPostId(apiEndpoint, headers);
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/posts/${encodeURIComponent(postId)}/content?lang=xx`,
      { headers },
    );
    expect(res.status).toBe(400);
  });

  it('GET /v1/posts/{postId}/content for a post id that does not exist returns 404', async () => {
    const res = await fetchWithRetry(
      `${apiEndpoint}/v1/posts/${encodeURIComponent('e2e-nonexistent-post-id')}/content`,
      { headers },
    );
    expect(res.status).toBe(404);
  });
});

describe.skipIf(!testCredentials)('API account deletion E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverStageResources();
    apiEndpoint = await getApiEndpoint(resources.apiId);
    // biome-ignore lint/style/noNonNullAssertion: describe.skipIf above guarantees this block only runs when testCredentials is set.
    const idToken = await fetchTestIdToken(testCredentials!);
    headers = { Authorization: `Bearer ${idToken}`, [DEVICE_LANGUAGE_HEADER]: 'en' };
  }, 60_000);

  it('DELETE /v1/me deletes the account, and GET /v1/me recreates a fresh default row', async () => {
    const deleteRes = await fetchWithRetry(`${apiEndpoint}/v1/me`, {
      method: 'DELETE',
      headers,
    });
    expect(deleteRes.status).toBe(204);

    const meRes = await fetchWithRetry(`${apiEndpoint}/v1/me`, { headers });
    expect(meRes.status).toBe(200);
    const meBody = meResponseSchema.parse(await meRes.json());
    expect(meBody.topics).toEqual([]);
    expect(meBody.mutedSources).toEqual([]);
  });

  it('DELETE /v1/me is idempotent — deleting an already-deleted account still returns 204', async () => {
    const res = await fetchWithRetry(`${apiEndpoint}/v1/me`, { method: 'DELETE', headers });
    expect(res.status).toBe(204);
  });
});
