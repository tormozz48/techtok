import { DEVICE_ID_HEADER } from '@techtok/shared';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractDeviceId(event: APIGatewayProxyEventV2): string | undefined {
  const value = event.headers[DEVICE_ID_HEADER];
  if (!value || !UUID_RE.test(value)) return undefined;
  return value;
}
