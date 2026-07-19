import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { extractDeviceId } from './deviceId';

function eventWithHeaders(headers: Record<string, string | undefined>): APIGatewayProxyEventV2 {
  return { headers } as unknown as APIGatewayProxyEventV2;
}

describe('extractDeviceId', () => {
  it('returns the header value when it is a valid uuid', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(extractDeviceId(eventWithHeaders({ 'x-device-id': id }))).toBe(id);
  });

  it('returns undefined when the header is missing', () => {
    expect(extractDeviceId(eventWithHeaders({}))).toBeUndefined();
  });

  it('returns undefined when the header is not a valid uuid', () => {
    expect(extractDeviceId(eventWithHeaders({ 'x-device-id': 'not-a-uuid' }))).toBeUndefined();
  });
});
