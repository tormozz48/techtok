import { feedQuerySchema, readsRequestSchema } from '@techtok/shared';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import {
  errorResponse,
  jsonResponse,
  noContent,
  parseJsonBody,
  parseQuery,
  withDeviceId,
} from './http';

const DEVICE_ID = '123e4567-e89b-12d3-a456-426614174000';

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return { headers: {}, ...overrides } as APIGatewayProxyEventV2;
}

async function invoke(handler: ReturnType<typeof withDeviceId>, event: APIGatewayProxyEventV2) {
  return handler(event, {} as Context, () => undefined);
}

describe('jsonResponse', () => {
  it('serializes the body with a json content-type', () => {
    expect(jsonResponse(200, { hello: 'world' })).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"hello":"world"}',
    });
  });
});

describe('errorResponse', () => {
  it('wraps code and message in the shared error envelope', () => {
    const response = errorResponse(404, 'post_not_found', 'No post with that id');
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body ?? '')).toEqual({
      error: { code: 'post_not_found', message: 'No post with that id' },
    });
  });
});

describe('noContent', () => {
  it('returns an empty 204', () => {
    expect(noContent()).toEqual({ statusCode: 204, body: '' });
  });
});

describe('parseQuery', () => {
  it('parses query parameters and applies schema defaults', () => {
    const result = parseQuery(
      makeEvent({ queryStringParameters: { limit: '5' } }),
      feedQuerySchema,
    );
    expect(result).toEqual({ ok: true, data: { limit: 5 } });
  });

  it('treats a missing query string as an empty object', () => {
    const result = parseQuery(makeEvent(), feedQuerySchema);
    expect(result).toEqual({ ok: true, data: { limit: 20 } });
  });

  it('returns an invalid_query 400 when validation fails', () => {
    const result = parseQuery(
      makeEvent({ queryStringParameters: { limit: '999' } }),
      feedQuerySchema,
    );
    if (result.ok) throw new Error('expected a failed parse');
    expect(result.response.statusCode).toBe(400);
    expect(JSON.parse(result.response.body ?? '').error.code).toBe('invalid_query');
  });
});

describe('parseJsonBody', () => {
  it('parses a valid JSON body against the schema', () => {
    const event = makeEvent({ body: JSON.stringify({ postIds: ['abc'] }) });
    expect(parseJsonBody(event, readsRequestSchema)).toEqual({
      ok: true,
      data: { postIds: ['abc'] },
    });
  });

  it('returns an invalid_body 400 for malformed JSON', () => {
    const result = parseJsonBody(makeEvent({ body: '{nope' }), readsRequestSchema);
    if (result.ok) throw new Error('expected a failed parse');
    expect(result.response.statusCode).toBe(400);
    expect(JSON.parse(result.response.body ?? '').error).toEqual({
      code: 'invalid_body',
      message: 'Body is not valid JSON',
    });
  });

  it('returns an invalid_body 400 when the schema rejects the body', () => {
    const result = parseJsonBody(makeEvent({ body: '{}' }), readsRequestSchema);
    if (result.ok) throw new Error('expected a failed parse');
    expect(result.response.statusCode).toBe(400);
    expect(JSON.parse(result.response.body ?? '').error.code).toBe('invalid_body');
  });
});

describe('withDeviceId', () => {
  it('rejects a request without a valid device id before the handler runs', async () => {
    let called = false;
    const handler = withDeviceId(async () => {
      called = true;
      return noContent();
    });

    const response = await invoke(handler, makeEvent({ headers: { 'x-device-id': 'nope' } }));

    expect(called).toBe(false);
    expect(response).toMatchObject({ statusCode: 400 });
    expect(JSON.parse((response as { body?: string }).body ?? '').error.code).toBe(
      'missing_device_id',
    );
  });

  it('passes the extracted device id through to the handler', async () => {
    const handler = withDeviceId(async (_event, deviceId) => jsonResponse(200, { deviceId }));

    const response = await invoke(handler, makeEvent({ headers: { 'x-device-id': DEVICE_ID } }));

    expect(response).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((response as { body?: string }).body ?? '')).toEqual({
      deviceId: DEVICE_ID,
    });
  });
});
