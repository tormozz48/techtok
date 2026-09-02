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
