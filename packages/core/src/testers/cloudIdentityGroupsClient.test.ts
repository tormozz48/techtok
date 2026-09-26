import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTesterGroupClient } from './cloudIdentityGroupsClient';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const SERVICE_ACCOUNT_KEY_JSON = JSON.stringify({
  client_email: 'play-verify@techtok-play.iam.gserviceaccount.com',
  private_key: privateKey,
  token_uri: 'https://oauth2.googleapis.com/token',
});

const GROUP_EMAIL = 'testers@techtokapp.eu';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubGoogle(membershipResponses: Response[]) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return json({ access_token: 'ya29.test', expires_in: 3600 });
    }
    if (url.includes('/groups:lookup')) return json({ name: 'groups/abc123' });
    return membershipResponses.shift() ?? json({}, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createTesterGroupClient.addMember', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('looks up the group, then creates a MEMBER membership for the email', async () => {
    const fetchMock = stubGoogle([json({ done: true })]);

    const client = createTesterGroupClient(SERVICE_ACCOUNT_KEY_JSON, GROUP_EMAIL);

    await expect(client.addMember('new@gmail.com')).resolves.toBe('added');
    const lookupUrl = fetchMock.mock.calls[1]?.[0];
    expect(lookupUrl).toBe(
      'https://cloudidentity.googleapis.com/v1/groups:lookup?groupKey.id=testers%40techtokapp.eu',
    );
    const [createUrl, createInit] = fetchMock.mock.calls[2] ?? [];
    expect(createUrl).toBe('https://cloudidentity.googleapis.com/v1/groups/abc123/memberships');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(createInit?.body as string)).toEqual({
      preferredMemberKey: { id: 'new@gmail.com' },
      roles: [{ name: 'MEMBER' }],
    });
  });

  it('reports already_member on a 409 instead of throwing', async () => {
    stubGoogle([json({ error: { status: 'ALREADY_EXISTS' } }, 409)]);

    const client = createTesterGroupClient(SERVICE_ACCOUNT_KEY_JSON, GROUP_EMAIL);

    await expect(client.addMember('existing@gmail.com')).resolves.toBe('already_member');
  });

  it("throws with Google's response body on any other failure", async () => {
    stubGoogle([json({ error: { message: 'Not authorized to access this resource' } }, 403)]);

    const client = createTesterGroupClient(SERVICE_ACCOUNT_KEY_JSON, GROUP_EMAIL);

    await expect(client.addMember('new@gmail.com')).rejects.toThrow(
      /status 403: .*Not authorized to access this resource/,
    );
  });

  it('looks the group up only once across calls', async () => {
    const fetchMock = stubGoogle([json({ done: true }), json({ done: true })]);

    const client = createTesterGroupClient(SERVICE_ACCOUNT_KEY_JSON, GROUP_EMAIL);
    await client.addMember('a@gmail.com');
    await client.addMember('b@gmail.com');

    const lookups = fetchMock.mock.calls.filter(([url]) => url.includes('/groups:lookup'));
    expect(lookups).toHaveLength(1);
  });
});
