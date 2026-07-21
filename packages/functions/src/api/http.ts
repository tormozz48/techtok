import { DEVICE_ID_HEADER, type ErrorResponse } from '@techtok/shared';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { z } from 'zod';
import { extractDeviceId } from './deviceId';

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
): APIGatewayProxyStructuredResultV2 {
  return jsonResponse(statusCode, { error: { code, message } } satisfies ErrorResponse);
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, body: '' };
}

export type ParseOutcome<S extends z.ZodType> =
  | { ok: true; data: z.output<S> }
  | { ok: false; response: APIGatewayProxyStructuredResultV2 };

export function parseQuery<S extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: S,
): ParseOutcome<S> {
  const parsed = schema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return { ok: false, response: errorResponse(400, 'invalid_query', parsed.error.message) };
  }
  return { ok: true, data: parsed.data };
}

export function parseJsonBody<S extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: S,
): ParseOutcome<S> {
  let raw: unknown;
  try {
    raw = JSON.parse(event.body ?? '{}');
  } catch {
    return { ok: false, response: errorResponse(400, 'invalid_body', 'Body is not valid JSON') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: errorResponse(400, 'invalid_body', parsed.error.message) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Device-identity middleware (DESIGN §5.1): rejects requests without a valid
 * `X-Device-Id` header before the wrapped handler runs, so handlers only ever
 * see an authenticated deviceId.
 */
export function withDeviceId(
  handle: (event: APIGatewayProxyEventV2, deviceId: string) => Promise<APIGatewayProxyResultV2>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const deviceId = extractDeviceId(event);
    if (!deviceId) {
      return errorResponse(400, 'missing_device_id', `${DEVICE_ID_HEADER} header is required`);
    }
    return handle(event, deviceId);
  };
}
