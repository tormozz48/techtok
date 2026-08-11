import {
  DEVICE_LANGUAGE_HEADER,
  DEVICE_TIMEZONE_HEADER,
  isLanguage,
  type Language,
} from '@techtok/shared';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/** The claims API Gateway's HTTP API JWT authorizer attaches to
 * `event.requestContext.authorizer.jwt.claims` once it has already verified
 * the token's signature/issuer/audience/expiry — a route wired to the
 * authorizer never reaches its handler without a valid token, so this is a
 * read of already-trusted data, not a second verification pass. */
interface JwtAuthorizerEvent extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface AuthContext {
  /** `"g:" + <Google sub>` (D68) — replaces the old device-UUID `userId`. */
  readonly userId: string;
  readonly email?: string;
  readonly name?: string;
}

/** Reads the verified Google identity off the JWT authorizer's claims.
 * Returns undefined only in the unit-test/local-invoke case where no
 * authorizer ran — a real deployed route wired to the Google JWT authorizer
 * never lets an unauthenticated request reach a handler at all. */
export function extractAuthContext(event: APIGatewayProxyEventV2): AuthContext | undefined {
  const claims = (event as JwtAuthorizerEvent).requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || sub.length === 0) return undefined;

  const email = claims?.email;
  const name = claims?.name;
  return {
    userId: `g:${sub}`,
    email: typeof email === 'string' ? email : undefined,
    name: typeof name === 'string' ? name : undefined,
  };
}

/** Device-reported locale (D20's "device-locale default on first sight"),
 * used only to seed a brand-new user's language — never trusted beyond that,
 * since `UsersRepo.touch`'s `if_not_exists` never overwrites a chosen one. */
export function extractDeviceLanguage(event: APIGatewayProxyEventV2): Language | undefined {
  const value = event.headers[DEVICE_LANGUAGE_HEADER];
  if (!value || !isLanguage(value)) return undefined;
  return value;
}

const IANA_TIMEZONE_RE = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/;

/** Device-reported IANA timezone (D69's local-midnight quota reset), seeded
 * on first touch only — same first-touch-only contract as the language
 * header above. A loose shape check only (not a real tz-database lookup);
 * an invalid value just means the server falls back to UTC (D69). */
export function extractDeviceTimezone(event: APIGatewayProxyEventV2): string | undefined {
  const value = event.headers[DEVICE_TIMEZONE_HEADER];
  if (!value || !IANA_TIMEZONE_RE.test(value)) return undefined;
  return value;
}
