import { PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAY_PURCHASE_FIXTURES } from './__fixtures__/playPurchaseFixtures';
import type { AccessTokenProvider } from './googleAccessToken';
import { createPlayApiClientWithTokenProvider } from './playApiClient';

const PACKAGE_NAME = 'com.tormozz48dev.techtok';

const ACTIVE_FIXTURE = PLAY_PURCHASE_FIXTURES[0]?.response ?? {};

const tokenProvider: AccessTokenProvider = { getAccessToken: async () => 'ya29.test-token' };

describe('createPlayApiClientWithTokenProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls subscriptionsv2 with the bearer token and returns the parsed purchase', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(ACTIVE_FIXTURE), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    const result = await client.getSubscriptionPurchase('token-abc');

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.purchase.lineItems?.[0]?.productId).toBe(PLUS_SUBSCRIPTION_PRODUCT_ID);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tormozz48dev.techtok/purchases/subscriptionsv2/tokens/token-abc',
      expect.objectContaining({
        headers: { Authorization: 'Bearer ya29.test-token' },
      }),
    );
  });

  it('percent-encodes a purchase token so it cannot escape the path', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(ACTIVE_FIXTURE), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    await client.getSubscriptionPurchase('../../../evil?x=1');

    expect(fetchMock.mock.calls[0]?.[0]).toContain('tokens/..%2F..%2F..%2Fevil%3Fx%3D1');
  });

  it.each([400, 404, 410])('reports a forged token as not found on a %i', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":{"message":"not found"}}', { status })),
    );

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);

    await expect(client.getSubscriptionPurchase('forged')).resolves.toEqual({ found: false });
  });

  it.each([401, 403, 429, 500, 503])(
    'throws on a %i so the request retries instead of silently downgrading',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status })),
      );

      const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);

      await expect(client.getSubscriptionPurchase('token-abc')).rejects.toThrow(
        `Play Developer API request failed with status ${status}`,
      );
    },
  );

  it('throws when the payload is not a subscription purchase at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ lineItems: 'nope' }), { status: 200 })),
    );

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);

    await expect(client.getSubscriptionPurchase('token-abc')).rejects.toThrow(
      'Play Developer API returned an unrecognized subscription payload',
    );
  });

  it('tolerates fields Google adds later', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ...ACTIVE_FIXTURE, somethingBrandNew: { a: 1 } }), {
            status: 200,
          }),
      ),
    );

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);

    await expect(client.getSubscriptionPurchase('token-abc')).resolves.toMatchObject({
      found: true,
    });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function createFetchMock(responses: Response[]) {
  return vi.fn(
    async (_url: string, _init?: RequestInit) => responses.shift() ?? jsonResponse({}, 500),
  );
}

describe('createPlayApiClientWithTokenProvider.addTester', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds a new email and verifies it after commit', async () => {
    const responses = [
      jsonResponse({ id: 'edit-1' }),
      jsonResponse({ googleEmails: ['existing@example.com'] }),
      jsonResponse({}),
      jsonResponse({}),
      jsonResponse({ id: 'edit-2' }),
      jsonResponse({ googleEmails: ['existing@example.com', 'new@example.com'] }),
    ];
    const fetchMock = createFetchMock(responses);
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    await expect(client.addTester('alpha', 'new@example.com')).resolves.toEqual({ added: true });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const putInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(putInit).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(putInit.body as string)).toEqual({
      googleEmails: ['existing@example.com', 'new@example.com'],
    });
  });

  it('returns added: false without writing when the email is already on the track', async () => {
    const responses = [
      jsonResponse({ id: 'edit-1' }),
      jsonResponse({ googleEmails: ['already@example.com'] }),
    ];
    const fetchMock = createFetchMock(responses);
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    await expect(client.addTester('alpha', 'already@example.com')).resolves.toEqual({
      added: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a full edit cycle once if verification shows the email missing', async () => {
    const responses = [
      jsonResponse({ id: 'edit-1' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({}),
      jsonResponse({}),
      jsonResponse({ id: 'edit-2' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({ id: 'edit-3' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({}),
      jsonResponse({}),
      jsonResponse({ id: 'edit-4' }),
      jsonResponse({ googleEmails: ['new@example.com'] }),
    ];
    const fetchMock = createFetchMock(responses);
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    await expect(client.addTester('alpha', 'new@example.com')).resolves.toEqual({ added: true });
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('throws once verification keeps failing after the last retry', async () => {
    const responses = [
      jsonResponse({ id: 'edit-1' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({}),
      jsonResponse({}),
      jsonResponse({ id: 'edit-2' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({ id: 'edit-3' }),
      jsonResponse({ googleEmails: [] }),
      jsonResponse({}),
      jsonResponse({}),
      jsonResponse({ id: 'edit-4' }),
      jsonResponse({ googleEmails: [] }),
    ];
    const fetchMock = createFetchMock(responses);
    vi.stubGlobal('fetch', fetchMock);

    const client = createPlayApiClientWithTokenProvider(tokenProvider, PACKAGE_NAME);
    await expect(client.addTester('alpha', 'new@example.com')).rejects.toThrow(
      'Play Developer API did not retain the added tester after commit',
    );
  });
});
