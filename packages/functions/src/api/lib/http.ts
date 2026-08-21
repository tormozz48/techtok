import { Logger } from '@aws-lambda-powertools/logger';
import { errorMessage } from '@techtok/core';
import { type ErrorResponse, REQUEST_ID_HEADER } from '@techtok/shared';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { z } from 'zod';
import { type AuthContext, extractAuthContext } from './auth';

const logger = new Logger({ serviceName: 'api' });

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

function requestContext(event: APIGatewayProxyEventV2): Record<string, unknown> {
  return {
    requestId: event.requestContext.requestId,
    clientRequestId: event.headers[REQUEST_ID_HEADER],
    route: event.routeKey,
  };
}

async function runWithLogging(
  context: Record<string, unknown>,
  handle: () => Promise<APIGatewayProxyResultV2>,
): Promise<APIGatewayProxyResultV2> {
  const start = Date.now();
  try {
    const result = await handle();
    logger.info('request completed', { ...context, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    logger.error('request failed', {
      ...context,
      durationMs: Date.now() - start,
      error: errorMessage(err),
    });
    throw err;
  }
}

export function withPublic(
  handle: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
): APIGatewayProxyHandlerV2 {
  return async (event) => runWithLogging(requestContext(event), () => handle(event));
}

export function withAuth(
  handle: (event: APIGatewayProxyEventV2, auth: AuthContext) => Promise<APIGatewayProxyResultV2>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const context = requestContext(event);
    const auth = extractAuthContext(event);
    if (!auth) {
      logger.warn('unauthorized request', context);
      return errorResponse(401, 'unauthorized', 'A valid Google ID token is required');
    }
    return runWithLogging({ ...context, userId: auth.userId }, () => handle(event, auth));
  };
}
