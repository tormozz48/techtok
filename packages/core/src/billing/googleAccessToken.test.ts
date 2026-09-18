import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANDROID_PUBLISHER_SCOPE,
  createServiceAccountTokenProvider,
  parseServiceAccountKey,
} from './googleAccessToken';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const SERVICE_ACCOUNT_KEY = {
  type: 'service_account',
  project_id: 'techtok-play',
  client_email: 'play-verify@techtok-play.iam.gserviceaccount.com',
  private_key: privateKey,
  token_uri: 'https://oauth2.googleapis.com/token',
};

function tokenResponse(accessToken: string, expiresIn = 3600): Response {
  return new Response(
    JSON.stringify({ access_token: accessToken, expires_in: expiresIn, token_type: 'Bearer' }),
    { status: 200 },
  );
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('parseServiceAccountKey', () => {
  it('accepts a real service account key shape', () => {
    const key = parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY));

    expect(key.client_email).toBe('play-verify@techtok-play.iam.gserviceaccount.com');
    expect(key.token_uri).toBe('https://oauth2.googleapis.com/token');
  });

  it('defaults the token endpoint when the key omits it', () => {
    const { token_uri: _omitted, ...withoutTokenUri } = SERVICE_ACCOUNT_KEY;

    expect(parseServiceAccountKey(JSON.stringify(withoutTokenUri)).token_uri).toBe(
      'https://oauth2.googleapis.com/token',
    );
  });

  it('rejects a value that is not JSON', () => {
    expect(() => parseServiceAccountKey('not json')).toThrow(
      'Google service account key is not valid JSON',
    );
  });

  it('rejects a key missing its private key', () => {
    const { private_key: _omitted, ...withoutPrivateKey } = SERVICE_ACCOUNT_KEY;

    expect(() => parseServiceAccountKey(JSON.stringify(withoutPrivateKey))).toThrow(
      'Google service account key is missing client_email or private_key',
    );
  });
});

describe('createServiceAccountTokenProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges a correctly signed RS256 assertion for an access token', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse('ya29.first'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );
    const token = await provider.getAccessToken();

    expect(token).toBe('ya29.first');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');

    const body = new URLSearchParams(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

    const assertion = body.get('assertion') ?? '';
    const [header, claims, signature] = assertion.split('.');
    expect(decodeSegment(header ?? '')).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodeSegment(claims ?? '')).toMatchObject({
      iss: 'play-verify@techtok-play.iam.gserviceaccount.com',
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
    });

    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature ?? '', 'base64url'));
    expect(verified).toBe(true);
  });

  it('requests an expiry an hour out and no further', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse('ya29.first'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );
    await provider.getAccessToken();

    const body = new URLSearchParams(fetchMock.mock.calls[0]?.[1]?.body as string);
    const claims = decodeSegment((body.get('assertion') ?? '').split('.')[1] ?? '');
    expect(Number(claims.exp) - Number(claims.iat)).toBe(3600);
  });

  it('reuses a cached token instead of re-signing on every call', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse('ya29.first'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );
    await provider.getAccessToken();
    await provider.getAccessToken();
    await provider.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-exchanges once the cached token falls inside the expiry skew', async () => {
    let issued = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse(`ya29.${++issued}`, 30),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );

    expect(await provider.getAccessToken()).toBe('ya29.1');
    expect(await provider.getAccessToken()).toBe('ya29.2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the token endpoint rejects the assertion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 })),
    );

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );

    await expect(provider.getAccessToken()).rejects.toThrow(
      'Google token exchange failed with status 400',
    );
  });

  it('throws when the token endpoint returns no access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token_type: 'Bearer' }), { status: 200 })),
    );

    const provider = createServiceAccountTokenProvider(
      parseServiceAccountKey(JSON.stringify(SERVICE_ACCOUNT_KEY)),
    );

    await expect(provider.getAccessToken()).rejects.toThrow(
      'Google token exchange returned no access_token',
    );
  });
});
