import type { UserRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toMeResponse } from './toMeResponse';

describe('toMeResponse', () => {
  it('maps the user record to the me-response shape', () => {
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
    });
  });
});
