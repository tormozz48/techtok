import type { ErrorResponse } from '@techtok/shared';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { z } from 'zod';
import { type AuthContext, extractAuthContext } from './auth';

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
 * Google-identity middleware (DESIGN §5, D68): every route wired to the API
 * Gateway JWT authorizer only ever reaches its handler with an
 * already-verified token, so this just reads the resulting claims. The 401
 * branch is defensive (unit tests / a route accidentally left off the
 * authorizer) rather than a real code path in production.
 */
export function withAuth(
  handle: (event: APIGatewayProxyEventV2, auth: AuthContext) => Promise<APIGatewayProxyResultV2>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const auth = extractAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'unauthorized', 'A valid Google ID token is required');
    }
    return handle(event, auth);
  };
}
