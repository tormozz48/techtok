import {
  DEVICE_ID_HEADER,
  DEVICE_LANGUAGE_HEADER,
  isLanguage,
  type Language,
} from '@techtok/shared';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractDeviceId(event: APIGatewayProxyEventV2): string | undefined {
  const value = event.headers[DEVICE_ID_HEADER];
  if (!value || !UUID_RE.test(value)) return undefined;
  return value;
}

/** Device-reported locale (D20's "device-locale default on first sight"),
 * used only to seed a brand-new user's language — never trusted beyond that,
 * since `UsersRepo.touch`'s `if_not_exists` never overwrites a chosen one. */
export function extractDeviceLanguage(event: APIGatewayProxyEventV2): Language | undefined {
  const value = event.headers[DEVICE_LANGUAGE_HEADER];
  if (!value || !isLanguage(value)) return undefined;
  return value;
}
