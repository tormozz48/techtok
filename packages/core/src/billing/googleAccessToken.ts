import { createSign } from 'node:crypto';
import { z } from 'zod';

export const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

const JWT_LIFETIME_SECONDS = 3600;

const EXPIRY_SKEW_SECONDS = 60;

const serviceAccountKeySchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  token_uri: z.string().min(1).default(DEFAULT_TOKEN_URI),
});
export type GoogleServiceAccountKey = z.infer<typeof serviceAccountKeySchema>;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
});

export interface AccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export function parseServiceAccountKey(rawJson: string): GoogleServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Google service account key is not valid JSON');
  }
  const result = serviceAccountKeySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Google service account key is missing client_email or private_key');
  }
  return result.data;
}

export function createServiceAccountTokenProvider(
  key: GoogleServiceAccountKey,
  scope: string = ANDROID_PUBLISHER_SCOPE,
): AccessTokenProvider {
  let cached: { token: string; expiresAtSeconds: number } | undefined;

  return {
    async getAccessToken(): Promise<string> {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (cached && cached.expiresAtSeconds - EXPIRY_SKEW_SECONDS > nowSeconds) {
        return cached.token;
      }

      const assertion = signJwt(key, scope, nowSeconds);
      const response = await fetch(key.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });
      if (!response.ok) {
        throw new Error(`Google token exchange failed with status ${response.status}`);
      }
      const body = tokenResponseSchema.safeParse(await response.json());
      if (!body.success) throw new Error('Google token exchange returned no access_token');

      cached = {
        token: body.data.access_token,
        expiresAtSeconds: nowSeconds + (body.data.expires_in ?? JWT_LIFETIME_SECONDS),
      };
      return cached.token;
    },
  };
}

function signJwt(key: GoogleServiceAccountKey, scope: string, nowSeconds: number): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: key.token_uri,
      iat: nowSeconds,
      exp: nowSeconds + JWT_LIFETIME_SECONDS,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(key.private_key)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
