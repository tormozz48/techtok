import {
  type AccessTokenProvider,
  createServiceAccountTokenProvider,
  parseServiceAccountKey,
} from './googleAccessToken';
import {
  type PlayApiClient,
  type PlayPurchaseLookup,
  playSubscriptionPurchaseSchema,
} from './playBilling.types';

const ANDROID_PUBLISHER_BASE_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const UNKNOWN_TOKEN_STATUSES: readonly number[] = [400, 404, 410];

const REQUEST_TIMEOUT_MS = 8_000;

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
  };
}
