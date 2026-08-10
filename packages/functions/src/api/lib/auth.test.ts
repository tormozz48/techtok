import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { extractAuthContext, extractDeviceLanguage, extractDeviceTimezone } from './auth';

function eventWithClaims(claims: Record<string, unknown> | undefined): APIGatewayProxyEventV2 {
  return {
    headers: {},
    requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
  } as unknown as APIGatewayProxyEventV2;
}

function eventWithHeaders(headers: Record<string, string | undefined>): APIGatewayProxyEventV2 {
  return { headers } as unknown as APIGatewayProxyEventV2;
}

describe('extractAuthContext', () => {
  it('prefixes the Google sub into userId and carries email/name', () => {
    const auth = extractAuthContext(
      eventWithClaims({ sub: '1234567890', email: 'a@example.com', name: 'Ada' }),
    );
    expect(auth).toEqual({ userId: 'g:1234567890', email: 'a@example.com', name: 'Ada' });
  });

  it('returns email/name as undefined when the claims omit them', () => {
    const auth = extractAuthContext(eventWithClaims({ sub: '1234567890' }));
    expect(auth).toEqual({ userId: 'g:1234567890', email: undefined, name: undefined });
  });

  it('returns undefined when there is no authorizer context at all', () => {
    expect(extractAuthContext(eventWithClaims(undefined))).toBeUndefined();
  });

  it('returns undefined when sub is missing', () => {
    expect(extractAuthContext(eventWithClaims({ email: 'a@example.com' }))).toBeUndefined();
  });

  it('returns undefined when sub is not a string', () => {
    expect(extractAuthContext(eventWithClaims({ sub: 12345 }))).toBeUndefined();
  });

  it('ignores non-string email/name claims', () => {
    const auth = extractAuthContext(eventWithClaims({ sub: '1', email: 42, name: [] }));
    expect(auth).toEqual({ userId: 'g:1', email: undefined, name: undefined });
  });
});

describe('extractDeviceLanguage', () => {
  it('returns the header value when it is a supported language', () => {
    expect(extractDeviceLanguage(eventWithHeaders({ 'x-device-language': 'ru' }))).toBe('ru');
  });

  it('returns undefined when the header is missing', () => {
    expect(extractDeviceLanguage(eventWithHeaders({}))).toBeUndefined();
  });

  it('returns undefined when the header is not a supported language', () => {
    expect(extractDeviceLanguage(eventWithHeaders({ 'x-device-language': 'fr' }))).toBeUndefined();
  });
});

describe('extractDeviceTimezone', () => {
  it('returns the header value when it looks like an IANA timezone', () => {
    expect(extractDeviceTimezone(eventWithHeaders({ 'x-device-timezone': 'Europe/Warsaw' }))).toBe(
      'Europe/Warsaw',
    );
  });

  it('returns undefined when the header is missing', () => {
    expect(extractDeviceTimezone(eventWithHeaders({}))).toBeUndefined();
  });

  it('accepts single-segment zone names like UTC', () => {
    expect(extractDeviceTimezone(eventWithHeaders({ 'x-device-timezone': 'UTC' }))).toBe('UTC');
  });

  it('returns undefined for a value containing whitespace', () => {
    expect(
      extractDeviceTimezone(eventWithHeaders({ 'x-device-timezone': 'not a timezone' })),
    ).toBeUndefined();
  });
});
