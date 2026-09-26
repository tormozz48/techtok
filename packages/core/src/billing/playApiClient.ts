import {
  type AccessTokenProvider,
  createServiceAccountTokenProvider,
  parseServiceAccountKey,
} from './googleAccessToken';
import {
  type PlayApiClient,
  type PlayPurchaseLookup,
  playEditInsertSchema,
  playEditTestersSchema,
  playSubscriptionPurchaseSchema,
} from './playBilling.types';

const ANDROID_PUBLISHER_BASE_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const UNKNOWN_TOKEN_STATUSES: readonly number[] = [400, 404, 410];

const REQUEST_TIMEOUT_MS = 8_000;

const ADD_TESTER_ATTEMPTS = 2;

export function createPlayApiClient(
  serviceAccountKeyJson: string,
  packageName: string,
): PlayApiClient {
  const tokenProvider = createServiceAccountTokenProvider(
    parseServiceAccountKey(serviceAccountKeyJson),
  );
  return createPlayApiClientWithTokenProvider(tokenProvider, packageName);
}

export function createPlayApiClientWithTokenProvider(
  tokenProvider: AccessTokenProvider,
  packageName: string,
): PlayApiClient {
  return {
    async getSubscriptionPurchase(purchaseToken: string): Promise<PlayPurchaseLookup> {
      const accessToken = await tokenProvider.getAccessToken();
      const url = `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(
        packageName,
      )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (UNKNOWN_TOKEN_STATUSES.includes(response.status)) return { found: false };
      if (!response.ok) {
        throw new Error(`Play Developer API request failed with status ${response.status}`);
      }

      const parsed = playSubscriptionPurchaseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error('Play Developer API returned an unrecognized subscription payload');
      }
      return { found: true, purchase: parsed.data };
    },

    async addTester(track: string, email: string): Promise<{ added: boolean }> {
      for (let attempt = 1; attempt <= ADD_TESTER_ATTEMPTS; attempt += 1) {
        const accessToken = await tokenProvider.getAccessToken();
        const editId = await insertEdit(accessToken, packageName);
        const current = await getEditTesters(accessToken, packageName, editId, track);
        const emails = current.googleEmails ?? [];
        if (emails.includes(email)) return { added: false };

        await putEditTesters(accessToken, packageName, editId, track, {
          googleGroups: current.googleGroups,
          googleEmails: [...emails, email],
        });
        await commitEdit(accessToken, packageName, editId);

        const verifyEditId = await insertEdit(accessToken, packageName);
        const verified = await getEditTesters(accessToken, packageName, verifyEditId, track);
        if ((verified.googleEmails ?? []).includes(email)) return { added: true };
        if (attempt === ADD_TESTER_ATTEMPTS) {
          throw new Error('Play Developer API did not retain the added tester after commit');
        }
      }
      throw new Error('unreachable');
    },
  };
}

async function insertEdit(accessToken: string, packageName: string): Promise<string> {
  const response = await fetch(
    `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(packageName)}/edits`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Play Developer API edit insert failed with status ${response.status}`);
  }
  const parsed = playEditInsertSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Play Developer API returned an unrecognized edit payload');
  return parsed.data.id;
}

async function getEditTesters(
  accessToken: string,
  packageName: string,
  editId: string,
  track: string,
) {
  const response = await fetch(
    `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}/testers/${encodeURIComponent(track)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Play Developer API get testers failed with status ${response.status}`);
  }
  const parsed = playEditTestersSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Play Developer API returned an unrecognized testers payload');
  }
  return parsed.data;
}

async function putEditTesters(
  accessToken: string,
  packageName: string,
  editId: string,
  track: string,
  body: { googleGroups?: string[]; googleEmails: string[] },
): Promise<void> {
  const response = await fetch(
    `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}/testers/${encodeURIComponent(track)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Play Developer API put testers failed with status ${response.status}`);
  }
}

async function commitEdit(accessToken: string, packageName: string, editId: string): Promise<void> {
  const response = await fetch(
    `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}:commit`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Play Developer API commit failed with status ${response.status}`);
  }
}
