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
import { discoverDevResources, getApiEndpoint } from './awsDiscovery';
import { fetchTestIdToken, readTestCredentials } from './googleTestAuth';

/** D68: the API now requires a verified Google ID token, so per-test
 * isolation via a random device UUID (the pre-D68 approach) no longer
 * exists — every test in this file authenticates as the same dedicated test
 * Google account. Vitest runs tests within one file/describe sequentially by
 * default, so this is safe, but it does mean these tests are no longer
 * independent of run order the way the old per-test identity made them; a
 * future test that needs true isolation would need a second test account. */
const testCredentials = readTestCredentials();

/**
 * ci.yml runs this suite immediately after `sst deploy --stage dev` — API
 * Gateway/Lambda occasionally return a transient 503 while that fresh
 * deployment finishes settling (confirmed via direct Lambda invoke and clean
 * CloudWatch logs for a request that got a 503 at the HTTP layer; the
 * schedule-triggered runs of this same suite, which hit an already-settled
 * stage, don't see this). Retrying a handful of times with a short backoff
 * absorbs that without masking a real, persistent failure.
 */
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

/**
 * Calls the real deployed `dev` API over HTTP — exactly the requests the
 * mobile client makes — and parses every response through the same
 * `packages/shared` zod schemas the app itself uses. A parse failure here
 * means an already-installed, sideloaded APK (no auto-update, D18) would
 * fail to render (DESIGN §2 D34). Never run against `production`. Skips
 * entirely when GOOGLE_TEST_REFRESH_TOKEN/GOOGLE_OAUTH_WEB_CLIENT_ID/
 * GOOGLE_OAUTH_WEB_CLIENT_SECRET aren't set (see googleTestAuth.ts) — true
 * for every environment except the maintainer-provisioned e2e.yml run.
 */
describe.skipIf(!testCredentials)('API contract E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverDevResources();
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

/**
 * Round-trips every mutation endpoint against the real `dev` API — the GET
 * suite above only ever reads, so a handler that's wired up wrong (e.g. an
 * env var/table link a route's infra config never declared) can 500 in
 * production while every GET-only contract test keeps passing, exactly what
 * happened to `POST /v1/bookmarks` (missing `usersTable` link). Post-D68,
 * every test in this file shares one authenticated identity (see the note
 * on `testCredentials` above) rather than a fresh device per test, so these
 * mutation tests run against — and mutate — the same user row in sequence.
 */
describe.skipIf(!testCredentials)('API mutation E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverDevResources();
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

/**
 * Exercises the Google JWT authorizer itself (D68) — no token, and a
 * malformed one, must never reach a handler. These don't need a minted test
 * token, only a reachable API endpoint, but are still gated behind
 * `testCredentials` since that's this suite's proxy for "running against a
 * real deployed `dev` stage with AWS discovery access."
 */
describe.skipIf(!testCredentials)('API auth failures E2E', () => {
  let apiEndpoint: string;

  beforeAll(async () => {
    const resources = await discoverDevResources();
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

/**
 * Validation, pagination, search and not-found scenarios beyond the
 * happy-path contract/mutation suites above — every 4xx branch a handler can
 * take, exercised against the real deployed `dev` stage. Shares the same
 * authenticated test identity and therefore the same ordering caveat noted
 * on `testCredentials` above.
 */
describe.skipIf(!testCredentials)('API validation & edge-case E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverDevResources();
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

/**
 * `DELETE /v1/me` — the one genuinely destructive, non-idempotent-feeling
 * endpoint. Placed last in this file on purpose: every describe block above
 * shares one authenticated test identity, and this deletes that identity's
 * profile row (D68 required this for Play policy). `UsersRepo.touch` recreates
 * a fresh default row lazily on the very next authenticated call (topics: [],
 * language back to whatever `DEVICE_LANGUAGE_HEADER` says), so this doesn't
 * strand the test account, but it does reset the preferences the mutation
 * suite above set — hence running strictly after everything else in this
 * file's sequential execution order.
 */
describe.skipIf(!testCredentials)('API account deletion E2E', () => {
  let apiEndpoint: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    const resources = await discoverDevResources();
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
