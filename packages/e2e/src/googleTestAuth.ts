/**
 * Mints a fresh Google ID token for the E2E suites (D68) by exchanging a
 * long-lived refresh token for a dedicated test Google account — the
 * standard pattern for testing a Google-authenticated API without a real
 * interactive sign-in flow in CI.
 *
 * One-time maintainer setup: create a dedicated Google test account, sign in
 * with it once through any OAuth consent flow using the same "Web
 * application" client this project uses (see infra/auth.ts), and capture
 * the resulting refresh token. Store it as the `GOOGLE_TEST_REFRESH_TOKEN`
 * GitHub secret alongside `GOOGLE_OAUTH_WEB_CLIENT_ID`/
 * `GOOGLE_OAUTH_WEB_CLIENT_SECRET` — none of which this environment has
 * access to, so this module cannot be exercised or verified from here.
 */

export interface TestCredentials {
  readonly refreshToken: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

/** Returns undefined (not a throw) when any credential is missing, so the
 * test suite can skip cleanly instead of failing — matches this repo's
 * existing rule that PR-triggered CI never holds credentials at all (only
 * the scheduled/manual-dispatch `e2e.yml` run would ever have these set). */
export function readTestCredentials(): TestCredentials | undefined {
  const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_WEB_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_WEB_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return undefined;
  return { refreshToken, clientId, clientSecret };
}

/** Exchanges the refresh token for a fresh ID token via Google's standard
 * OAuth token endpoint (`grant_type=refresh_token`) — the same flow a
 * long-lived server-side integration would use, not anything mobile-client
 * specific. */
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
