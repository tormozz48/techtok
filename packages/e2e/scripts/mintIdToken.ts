/**
 * Prints a fresh Google ID token for the dedicated E2E test account, by the
 * same refresh-token exchange the HTTP-level `apiContract.test.ts` suite
 * already uses (see ../src/googleTestAuth.ts).
 *
 * Used by scripts/runMobileE2e.sh to obtain the token it deep-links into the
 * app's sign-in bypass (apps/mobile/src/state/e2eAuth.ts). Requires
 * GOOGLE_TEST_REFRESH_TOKEN / GOOGLE_OAUTH_WEB_CLIENT_ID /
 * GOOGLE_OAUTH_WEB_CLIENT_SECRET to be set — see googleTestAuth.ts for how to
 * provision them. Exits 1 with the same "not provisioned" framing as the
 * HTTP suite's describe.skipIf, rather than a raw stack trace.
 *
 * Usage: tsx scripts/mintIdToken.ts
 */
import { fetchTestIdToken, readTestCredentials } from '../src/googleTestAuth';

const credentials = readTestCredentials();
if (!credentials) {
  console.error(
    'GOOGLE_TEST_REFRESH_TOKEN / GOOGLE_OAUTH_WEB_CLIENT_ID / GOOGLE_OAUTH_WEB_CLIENT_SECRET are not set. ' +
      'See packages/e2e/src/googleTestAuth.ts for how to provision the dedicated E2E test Google account.',
  );
  process.exit(1);
}

const idToken = await fetchTestIdToken(credentials);
process.stdout.write(idToken);
