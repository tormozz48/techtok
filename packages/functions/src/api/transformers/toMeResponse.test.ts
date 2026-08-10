import type { UserRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toMeResponse } from './toMeResponse';

describe('toMeResponse', () => {
  it('maps the user record to the me-response shape, defaulting language to en', () => {
    const user: UserRecord = {
      userId: 'device-1',
      topics: ['ai', 'dev'],
      createdAt: '2026-07-18T00:00:00.000Z',
      lastSeenAt: '2026-07-19T00:00:00.000Z',
    };

    expect(toMeResponse(user)).toEqual({
      userId: 'device-1',
      topics: ['ai', 'dev'],
      createdAt: '2026-07-18T00:00:00.000Z',
      language: 'en',
      mutedSources: [],
    });
  });

  it('carries through a set language', () => {
    const user: UserRecord = {
      userId: 'device-1',
      topics: [],
      createdAt: '2026-07-18T00:00:00.000Z',
      lastSeenAt: '2026-07-19T00:00:00.000Z',
      language: 'uk',
    };

    expect(toMeResponse(user)).toMatchObject({ language: 'uk' });
  });

  it('defaults mutedSources to an empty array when absent', () => {
    const user: UserRecord = {
      userId: 'device-1',
      topics: [],
      createdAt: '2026-07-18T00:00:00.000Z',
      lastSeenAt: '2026-07-19T00:00:00.000Z',
    };

    expect(toMeResponse(user).mutedSources).toEqual([]);
  });

  it('carries through a set mutedSources list', () => {
    const user: UserRecord = {
      userId: 'device-1',
      topics: [],
      createdAt: '2026-07-18T00:00:00.000Z',
      lastSeenAt: '2026-07-19T00:00:00.000Z',
      mutedSources: ['hn', 'verge'],
    };

    expect(toMeResponse(user).mutedSources).toEqual(['hn', 'verge']);
  });

  it('carries through email/name from the Google ID token (D68)', () => {
    const user: UserRecord = {
      userId: 'g:1234567890',
      topics: [],
      createdAt: '2026-07-18T00:00:00.000Z',
      lastSeenAt: '2026-07-19T00:00:00.000Z',
      email: 'ada@example.com',
      name: 'Ada',
    };

    expect(toMeResponse(user)).toMatchObject({ email: 'ada@example.com', name: 'Ada' });
  });
});
