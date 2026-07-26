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
    const deviceId = randomUUID();
    headers = { [DEVICE_ID_HEADER]: deviceId, [DEVICE_LANGUAGE_HEADER]: 'en' };
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
