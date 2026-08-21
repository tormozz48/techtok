import {
  DEVICE_LANGUAGE_HEADER,
  DEVICE_TIMEZONE_HEADER,
  isLanguage,
  type Language,
} from '@techtok/shared';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

interface JwtAuthorizerEvent extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface AuthContext {
  readonly userId: string;
  readonly email?: string;
  readonly name?: string;
}

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

export function extractDeviceLanguage(event: APIGatewayProxyEventV2): Language | undefined {
  const value = event.headers[DEVICE_LANGUAGE_HEADER];
  if (!value || !isLanguage(value)) return undefined;
  return value;
}

const IANA_TIMEZONE_RE = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/;

export function extractDeviceTimezone(event: APIGatewayProxyEventV2): string | undefined {
  const value = event.headers[DEVICE_TIMEZONE_HEADER];
  if (!value || !IANA_TIMEZONE_RE.test(value)) return undefined;
  return value;
}
