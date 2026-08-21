export interface TestCredentials {
  readonly refreshToken: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export function readTestCredentials(): TestCredentials | undefined {
  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_WEB_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_WEB_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return undefined;
  return { refreshToken, clientId, clientSecret };
}

export async function fetchTestIdToken(credentials: TestCredentials): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google token refresh failed with status ${response.status}: ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) {
    throw new Error('Google token refresh response had no id_token');
  }
  return body.id_token;
}
